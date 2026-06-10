/**
 * Capability: give an AI agent visual access to video content.
 * Replaces screenshot loops / manual frame grabs — hosted frame URLs go
 * straight into any vision model or multimodal agent.
 * SDK calls verified against videodb-python docs 2026-06-10; the offline
 * validator (scripts/validate-snippets.py) is the source of truth.
 */
export const agentVisionCode = `# Give your agent eyes: hosted frame URLs from any video — VideoDB
# pip install videodb   (docs: https://docs.videodb.io)
import videodb
from videodb import SceneExtractionType

conn = videodb.connect()  # reads VIDEO_DB_API_KEY from env

video = conn.upload(url={{videoUrl}})

# Sample one frame every N seconds. Each frame is a hosted image URL you
# can pass directly to any vision model / multimodal agent — no local
# files, no screenshot loop:
scene_collection = video.extract_scenes(
    extraction_type=SceneExtractionType.time_based,
    extraction_config={
        "time": {{intervalSec}},
        "frame_count": 1,
        "select_frames": ["middle"],
    },
)
frame_urls = [frame.url for scene in scene_collection.scenes for frame in scene.frames]
print(frame_urls[:5])

# Alternative: have VideoDB describe scenes server-side (text your agent
# can reason over without its own vision model) via video.index_scenes()
# with a custom prompt — see https://docs.videodb.io
`;
