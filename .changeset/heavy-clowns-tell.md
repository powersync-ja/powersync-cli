---
'powersync': patch
---

Added **`powersync compact`** to trigger compaction on the linked PowerSync Cloud instance and reclaim sync bucket storage. Supports an optional `--timeout=<minutes>` flag (default 30, use `0` to wait indefinitely) for long-running compactions on large buckets.
