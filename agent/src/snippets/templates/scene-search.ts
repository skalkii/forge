/**
 * Capability: scene / semantic visual search inside a video.
 * Replaces hand-rolled frame sampling + captioning + embedding pipelines.
 * SDK calls verified against the INSTALLED videodb package 2026-06-10
 * (docs showed SearchType.scene — doesn't exist; scene search is
 * search_type=semantic + index_type=scene). Live proof:
 * scripts/validate-snippets.ts.
 */
export const sceneSearchCode = `# Search inside a video by what's ON SCREEN — VideoDB
# pip install videodb   (docs: https://docs.videodb.io)
import time

import videodb
from videodb import SceneExtractionType, SearchType, IndexType

conn = videodb.connect()  # reads VIDEO_DB_API_KEY from env

video = conn.upload(url={{videoUrl}})

# Index every shot once (caption + embed handled server-side):
scene_index_id = video.index_scenes(
    extraction_type=SceneExtractionType.shot_based,
    prompt={{scenePrompt}},
)

# Indexing is async — wait until scene descriptions are ready:
while not video.get_scene_index(scene_index_id):
    time.sleep(5)

# Then search visually with natural language:
results = video.search(
    query={{query}},
    search_type=SearchType.semantic,
    index_type=IndexType.scene,
)
for shot in results.get_shots():
    print(f"{shot.start:.1f}s - {shot.end:.1f}s  {shot.text}")
`;
