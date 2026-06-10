/**
 * Capability: transcription + semantic search over spoken words.
 * Replaces the hand-rolled whisper → chunk → embed → vector-store pipeline.
 * SDK calls verified against videodb-python docs 2026-06-10; the offline
 * validator (scripts/validate-snippets.py) is the source of truth.
 */
export const transcribeSearchCode = `# Transcribe a video and semantically search what was said — VideoDB
# pip install videodb   (docs: https://docs.videodb.io)
import videodb
from videodb import SearchType, IndexType

conn = videodb.connect()  # reads VIDEO_DB_API_KEY from env

video = conn.upload(url={{videoUrl}})

# One call replaces whisper + chunking + embeddings + a vector store:
video.index_spoken_words()

results = video.search(
    query={{query}},
    search_type=SearchType.semantic,
    index_type=IndexType.spoken_word,
)
shots = results.get_shots()
for shot in shots:
    print(f"{shot.start:.1f}s - {shot.end:.1f}s  {shot.text}")

# Instant playable clip of just the matching moments:
if shots:
    stream_url = video.generate_stream(timeline=[(int(s.start), int(s.end)) for s in shots])
    print(stream_url)
`;
