//! Bounded, process-local TTL cache. Callers choose their own synchronization.
use std::{
    collections::HashMap,
    hash::Hash,
    time::{Duration, Instant},
};

struct Entry<V> {
    value: V,
    expires: Instant,
}

/// Entries expire after insertion; hits do not extend their lifetime.
/// At capacity the earliest-expiring entry is evicted. Zero capacity or TTL
/// disables storage. This cache neither persists nor coalesces concurrent work.
pub struct TtlCache<K, V> {
    entries: HashMap<K, Entry<V>>,
    capacity: usize,
    ttl: Duration,
}

impl<K: Eq + Hash + Clone, V> TtlCache<K, V> {
    pub fn new(capacity: usize, ttl: Duration) -> Self {
        Self {
            entries: HashMap::new(),
            capacity,
            ttl,
        }
    }

    pub fn get(&mut self, key: &K) -> Option<&V> {
        self.get_at(key, Instant::now())
    }

    fn get_at(&mut self, key: &K, now: Instant) -> Option<&V> {
        if self
            .entries
            .get(key)
            .is_some_and(|entry| entry.expires <= now)
        {
            self.entries.remove(key);
        }
        self.entries.get(key).map(|entry| &entry.value)
    }

    pub fn insert(&mut self, key: K, value: V) {
        self.insert_at(key, value, Instant::now());
    }

    fn insert_at(&mut self, key: K, value: V, now: Instant) {
        if self.capacity == 0 || self.ttl.is_zero() {
            return;
        }
        self.entries.retain(|_, entry| entry.expires > now);
        if !self.entries.contains_key(&key) && self.entries.len() >= self.capacity {
            if let Some(oldest) = self
                .entries
                .iter()
                .min_by_key(|(_, entry)| entry.expires)
                .map(|(key, _)| key.clone())
            {
                self.entries.remove(&oldest);
            }
        }
        self.entries.insert(
            key,
            Entry {
                value,
                expires: now + self.ttl,
            },
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn expires_without_extending_on_hits() {
        let now = Instant::now();
        let mut cache = TtlCache::new(2, Duration::from_secs(10));
        cache.insert_at("a", 1, now);
        assert_eq!(cache.get_at(&"a", now + Duration::from_secs(9)), Some(&1));
        assert_eq!(cache.get_at(&"a", now + Duration::from_secs(10)), None);
    }
    #[test]
    fn evicts_earliest_and_replaces_without_evicting_another_key() {
        let now = Instant::now();
        let mut cache = TtlCache::new(2, Duration::from_secs(10));
        cache.insert_at("a", 1, now);
        cache.insert_at("b", 2, now + Duration::from_secs(1));
        cache.insert_at("b", 3, now + Duration::from_secs(2));
        assert_eq!(cache.get_at(&"a", now), Some(&1));
        cache.insert_at("c", 4, now + Duration::from_secs(3));
        assert_eq!(cache.get_at(&"a", now), None);
        assert_eq!(cache.get_at(&"b", now + Duration::from_secs(3)), Some(&3));
        cache.insert_at("d", 5, now + Duration::from_secs(20));
        assert_eq!(cache.entries.len(), 1);
    }
    #[test]
    fn zero_capacity_or_ttl_disables_storage() {
        for (capacity, ttl) in [(0, Duration::from_secs(1)), (2, Duration::ZERO)] {
            let mut cache = TtlCache::new(capacity, ttl);
            cache.insert("a", 1);
            assert_eq!(cache.get(&"a"), None);
        }
    }
}
