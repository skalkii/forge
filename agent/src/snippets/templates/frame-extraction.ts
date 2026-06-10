/**
 * Capability: extract frames every N seconds, no ffmpeg.
 * Replaces ffmpeg -vf fps=... pipelines and local file juggling — frames
 * come back as hosted image URLs.
 * SDK calls verified against videodb-python docs 2026-06-10; the offline
 * validator (scripts/validate-snippets.py) is the source of truth.
 */
export const frameExtractionCode = `# Extract a frame every N seconds from a video — VideoDB (no ffmpeg)
# pip install videodb   (docs: https://docs.videodb.io)
import videodb
from videodb import SceneExtractionType

conn = videodb.connect()  # reads VIDEO_DB_API_KEY from env

video = conn.upload(url={{videoUrl}})

# Replaces the ffmpeg fps-filter pipeline; each frame is a hosted URL:
scene_collection = video.extract_scenes(
    extraction_type=SceneExtractionType.time_based,
    extraction_config={
        "time": {{intervalSec}},
        "frame_count": 1,
        "select_frames": ["middle"],
    },
)
for scene in scene_collection.scenes:
    for frame in scene.frames:
        print(f"{scene.start:.1f}s  {frame.url}")
`;
