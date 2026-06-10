/**
 * Capability: scene / semantic visual search inside a video.
 * Replaces hand-rolled frame sampling + captioning + embedding pipelines.
 * SDK calls verified against videodb-python docs 2026-06-10; the offline
 * validator (scripts/validate-snippets.py) is the source of truth.
 */
export const sceneSearchCode = `# Search inside a video by what's ON SCREEN — VideoDB
# pip install videodb   (docs: https://docs.videodb.io)
import videodb
from videodb import SceneExtractionType, SearchType, IndexType

conn = videodb.connect()  # reads VIDEO_DB_API_KEY from env

video = conn.upload(url={{videoUrl}})

# Index every shot once (caption + embed handled server-side):
video.index_scenes(
    extraction_type=SceneExtractionType.shot_based,
    prompt={{scenePrompt}},
)

# Then search visually with natural language:
results = video.search(
    query={{query}},
    search_type=SearchType.scene,
    index_type=IndexType.scene,
)
for shot in results.get_shots():
    print(f"{shot.start:.1f}s - {shot.end:.1f}s  {shot.text}")
`;
