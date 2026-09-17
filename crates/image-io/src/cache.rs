use std::collections::{BTreeMap, VecDeque};
use std::sync::Mutex;

pub const DEFAULT_CACHE_BYTES: usize = 64 * 1024 * 1024;

pub struct ReadCache {
    capacity: usize,
    inner: Mutex<CacheInner>,
}

#[derive(Default)]
struct CacheInner {
    blocks: BTreeMap<u64, Vec<u8>>,
    order: VecDeque<u64>,
    bytes: usize,
}

impl Default for ReadCache {
    fn default() -> Self {
        Self::new(DEFAULT_CACHE_BYTES)
    }
}

impl ReadCache {
    pub fn new(capacity: usize) -> Self {
        Self {
            capacity,
            inner: Mutex::new(CacheInner::default()),
        }
    }

    pub fn get(&self, offset: u64) -> Option<Vec<u8>> {
        self.inner
            .lock()
            .expect("cache mutex")
            .blocks
            .get(&offset)
            .cloned()
    }

    pub fn insert(&self, offset: u64, bytes: Vec<u8>) {
        if bytes.len() > self.capacity {
            return;
        }
        let mut inner = self.inner.lock().expect("cache mutex");
        if let Some(previous) = inner.blocks.remove(&offset) {
            inner.bytes -= previous.len();
        }
        while inner.bytes + bytes.len() > self.capacity {
            let Some(oldest) = inner.order.pop_front() else {
                break;
            };
            if let Some(removed) = inner.blocks.remove(&oldest) {
                inner.bytes -= removed.len();
            }
        }
        inner.bytes += bytes.len();
        inner.order.retain(|entry| *entry != offset);
        inner.order.push_back(offset);
        inner.blocks.insert(offset, bytes);
    }

    pub fn bytes_used(&self) -> usize {
        self.inner.lock().expect("cache mutex").bytes
    }
}
