from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Tuple
import uuid
from datetime import datetime, timedelta
import math


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# -------------------- Utility functions --------------------

def haversine_distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def bbox_from_center(lat: float, lng: float, radius_m: float) -> Tuple[float, float, float, float]:
    # returns (min_lat, min_lng, max_lat, max_lng)
    lat_delta = (radius_m / 111320.0)
    lng_delta = radius_m / (111320.0 * max(0.00001, math.cos(math.radians(lat))))
    return lat - lat_delta, lng - lng_delta, lat + lat_delta, lng + lng_delta


def mask_location(lat: float, lng: float, mode: str) -> Tuple[float, float]:
    if mode == 'exact':
        return lat, lng
    radius = 100.0 if mode == 'masked_100m' else 1000.0
    # random offset within circle radius using deterministic jitter from uuid for stability (but here random via uuid4)
    rnd = uuid.uuid4().int % 1000000
    angle = (rnd % 360) * math.pi / 180.0
    dist = (rnd % 1000) / 1000.0 * radius
    dlat = (dist / 111320.0) * math.sin(angle)
    dlng = (dist / (111320.0 * max(0.00001, math.cos(math.radians(lat))))) * math.cos(angle)
    return lat + dlat, lng + dlng


# -------------------- Models --------------------

LocationPrivacy = Literal['exact', 'masked_100m', 'masked_1km']


class StreamCreate(BaseModel):
    user_id: str
    lat: float
    lng: float
    privacy_mode: LocationPrivacy = 'exact'
    device_camera: Literal['front', 'back'] = 'back'


class StreamOut(BaseModel):
    id: str
    user_id: str
    lat: float
    lng: float
    started_at: datetime
    ended_at: Optional[datetime] = None
    viewer_count_peak: int = 0
    event_id: Optional[str] = None
    status: Literal['live', 'ended'] = 'live'
    privacy_mode: LocationPrivacy = 'exact'


class EventOut(BaseModel):
    id: str
    centroid_lat: float
    centroid_lng: float
    radius_meters: int = 50
    created_at: datetime
    ended_at: Optional[datetime] = None
    viewer_count_total: int = 0
    stream_count: int = 0
    hashtags: List[str] = []
    status: Literal['live', 'ended'] = 'live'


# -------------------- Routes (existing) --------------------

class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class StatusCheckCreate(BaseModel):
    client_name: str


@api_router.get("/")
async def root():
    return {"message": "Hello World"}


@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.model_dump())
    return status_obj


@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]


# -------------------- Streams & Events --------------------

async def assign_event_for_stream(stream_doc: dict) -> Optional[str]:
    """Find nearby streams (<=50m within last 10min). If found, join/create event and update documents."""
    now = datetime.utcnow()
    window_start = now - timedelta(minutes=10)
    lat = stream_doc['lat']
    lng = stream_doc['lng']

    min_lat, min_lng, max_lat, max_lng = bbox_from_center(lat, lng, 60.0)
    candidates = await db.streams.find({
        'status': 'live',
        'started_at': { '$gte': window_start },
        'lat': { '$gte': min_lat, '$lte': max_lat },
        'lng': { '$gte': min_lng, '$lte': max_lng },
        'id': { '$ne': stream_doc['id'] }
    }).to_list(100)

    # Filter precise by haversine
    nearby = []
    for s in candidates:
        d = haversine_distance_m(lat, lng, s['lat'], s['lng'])
        if d <= 50.0:
            nearby.append(s)

    if not nearby:
        return None

    # Join existing event if any nearby has one
    event_id = None
    for s in nearby:
        if s.get('event_id'):
            event_id = s['event_id']
            break

    if not event_id:
        # Create new event
        event_id = str(uuid.uuid4())
        participants = [stream_doc] + nearby
        centroid_lat = sum(p['lat'] for p in participants) / len(participants)
        centroid_lng = sum(p['lng'] for p in participants) / len(participants)
        event_doc = {
            'id': event_id,
            'centroid_lat': centroid_lat,
            'centroid_lng': centroid_lng,
            'radius_meters': 50,
            'created_at': now,
            'ended_at': None,
            'viewer_count_total': 0,
            'stream_count': len(participants),
            'hashtags': [],
            'status': 'live'
        }
        await db.events.insert_one(event_doc)
        # Update participants with event_id
        ids = [p['id'] for p in participants]
        await db.streams.update_many({'id': { '$in': ids }}, { '$set': { 'event_id': event_id }})
    else:
        # Join existing event and update centroid & count
        await db.streams.update_one({'id': stream_doc['id']}, { '$set': { 'event_id': event_id }})
        # Recompute centroid and stream_count
        event_streams = await db.streams.find({ 'event_id': event_id, 'status': 'live' }).to_list(100)
        if event_streams:
            centroid_lat = sum(p['lat'] for p in event_streams) / len(event_streams)
            centroid_lng = sum(p['lng'] for p in event_streams) / len(event_streams)
            await db.events.update_one({'id': event_id}, { '$set': {
                'centroid_lat': centroid_lat,
                'centroid_lng': centroid_lng,
                'stream_count': len(event_streams),
            }})

    return event_id


@api_router.post('/streams', response_model=StreamOut)
async def create_stream(payload: StreamCreate):
    now = datetime.utcnow()
    stream_id = str(uuid.uuid4())

    lat, lng = float(payload.lat), float(payload.lng)

    stream_doc = {
        'id': stream_id,
        'user_id': payload.user_id,
        'lat': lat,
        'lng': lng,
        'started_at': now,
        'ended_at': None,
        'viewer_count_peak': 0,
        'event_id': None,
        'status': 'live',
        'privacy_mode': payload.privacy_mode,
        'device_camera': payload.device_camera,
    }

    await db.streams.insert_one(stream_doc)

    # Assign event if nearby streams
    event_id = await assign_event_for_stream(stream_doc)
    if event_id:
        stream_doc['event_id'] = event_id
        await db.streams.update_one({'id': stream_id}, { '$set': { 'event_id': event_id }})

    # Prepare output with masking
    out_lat, out_lng = mask_location(lat, lng, payload.privacy_mode)
    out = StreamOut(
        id=stream_id,
        user_id=payload.user_id,
        lat=out_lat,
        lng=out_lng,
        started_at=now,
        ended_at=None,
        viewer_count_peak=0,
        event_id=event_id,
        status='live',
        privacy_mode=payload.privacy_mode
    )
    return out


@api_router.get('/streams/live')
async def get_live_streams(
    ne: Optional[str] = Query(None, description="NE corner as 'lat,lng'"),
    sw: Optional[str] = Query(None, description="SW corner as 'lat,lng'"),
):
    now = datetime.utcnow()
    query = { 'status': 'live', 'started_at': { '$lte': now } }

    if ne and sw:
        try:
            ne_lat, ne_lng = [float(x) for x in ne.split(',')]
            sw_lat, sw_lng = [float(x) for x in sw.split(',')]
            query.update({
                'lat': { '$gte': sw_lat, '$lte': ne_lat },
                'lng': { '$gte': sw_lng, '$lte': ne_lng },
            })
        except Exception:
            raise HTTPException(status_code=400, detail='Invalid bbox params')

    docs = await db.streams.find(query).to_list(1000)
    # Map to output + apply masking per privacy
    items = []
    for d in docs:
        out_lat, out_lng = mask_location(d['lat'], d['lng'], d.get('privacy_mode', 'exact'))
        items.append({
            'id': d['id'],
            'user_id': d['user_id'],
            'lat': out_lat,
            'lng': out_lng,
            'started_at': d['started_at'],
            'ended_at': d.get('ended_at'),
            'viewer_count_peak': d.get('viewer_count_peak', 0),
            'event_id': d.get('event_id'),
            'status': d.get('status', 'live'),
            'privacy_mode': d.get('privacy_mode', 'exact')
        })

    return { 'streams': items }


@api_router.post('/streams/{stream_id}/end')
async def end_stream(stream_id: str):
    now = datetime.utcnow()
    res = await db.streams.update_one({'id': stream_id, 'status': 'live'}, { '$set': { 'status': 'ended', 'ended_at': now }})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail='Stream not found or already ended')

    # If belonged to an event, check if event should end
    doc = await db.streams.find_one({'id': stream_id})
    if doc and doc.get('event_id'):
        ev_id = doc['event_id']
        live_count = await db.streams.count_documents({ 'event_id': ev_id, 'status': 'live' })
        if live_count == 0:
            await db.events.update_one({ 'id': ev_id }, { '$set': { 'status': 'ended', 'ended_at': now }})
    return { 'ok': True }


@api_router.get('/events/live', response_model=List[EventOut])
async def get_live_events(
    ne: Optional[str] = Query(None, description="NE corner as 'lat,lng'"),
    sw: Optional[str] = Query(None, description="SW corner as 'lat,lng'"),
):
    query = { 'status': 'live' }
    if ne and sw:
        try:
            ne_lat, ne_lng = [float(x) for x in ne.split(',')]
            sw_lat, sw_lng = [float(x) for x in sw.split(',')]
            query.update({
                'centroid_lat': { '$gte': sw_lat, '$lte': ne_lat },
                'centroid_lng': { '$gte': sw_lng, '$lte': ne_lng },
            })
        except Exception:
            raise HTTPException(status_code=400, detail='Invalid bbox params')

    docs = await db.events.find(query).to_list(500)
    out = []
    for e in docs:
        out.append(EventOut(
            id=e['id'],
            centroid_lat=e['centroid_lat'],
            centroid_lng=e['centroid_lng'],
            radius_meters=e.get('radius_meters', 50),
            created_at=e['created_at'],
            ended_at=e.get('ended_at'),
            viewer_count_total=e.get('viewer_count_total', 0),
            stream_count=e.get('stream_count', 0),
            hashtags=e.get('hashtags', []),
            status=e.get('status', 'live')
        ))
    return out


@api_router.get('/events/{event_id}')
async def get_event_detail(event_id: str):
    e = await db.events.find_one({ 'id': event_id })
    if not e:
        raise HTTPException(status_code=404, detail='Event not found')
    streams = await db.streams.find({ 'event_id': event_id }).to_list(200)
    # Mask stream locations when needed
    stream_items = []
    for d in streams:
        out_lat, out_lng = mask_location(d['lat'], d['lng'], d.get('privacy_mode', 'exact'))
        stream_items.append({
            'id': d['id'],
            'user_id': d['user_id'],
            'lat': out_lat,
            'lng': out_lng,
            'started_at': d['started_at'],
            'ended_at': d.get('ended_at'),
            'status': d.get('status', 'live'),
            'privacy_mode': d.get('privacy_mode', 'exact')
        })

    return {
        'event': {
            'id': e['id'],
            'centroid_lat': e['centroid_lat'],
            'centroid_lng': e['centroid_lng'],
            'radius_meters': e.get('radius_meters', 50),
            'created_at': e['created_at'],
            'ended_at': e.get('ended_at'),
            'viewer_count_total': e.get('viewer_count_total', 0),
            'stream_count': e.get('stream_count', 0),
            'hashtags': e.get('hashtags', []),
            'status': e.get('status', 'live')
        },
        'streams': stream_items
    }


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
