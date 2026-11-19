//! A single-owner, fully durable redb adapter. SQL is not part of the public API.
use anyhow::Result;
use redb::{ReadableDatabase, ReadableTable, TableDefinition};
use std::{ops::Bound, path::Path};
const TABLE: TableDefinition<&[u8], &[u8]> = TableDefinition::new("rune.v1");
pub struct Database(redb::Database);
pub enum Transaction {
    Read(redb::ReadTransaction),
    Write(redb::WriteTransaction),
}
pub enum Table<'a> {
    Read(redb::ReadOnlyTable<&'static [u8], &'static [u8]>),
    Write(redb::Table<'a, &'static [u8], &'static [u8]>),
}
pub enum Bytes<'a> {
    Guard(redb::AccessGuard<'a, &'static [u8]>),
    Owned(Vec<u8>),
}
impl Bytes<'_> {
    pub fn value(&self) -> &[u8] {
        match self {
            Self::Guard(v) => v.value(),
            Self::Owned(v) => v,
        }
    }
}
impl Database {
    pub fn open(path: &Path) -> Result<Self> {
        let db = redb::Database::builder()
            .set_cache_size(16 * 1024 * 1024)
            .set_concurrency_mode(redb::ConcurrencyMode::ExclusiveWriter)
            .create(path)?;
        let tx = db.begin_write()?;
        tx.open_table(TABLE)?;
        tx.commit()?;
        Ok(Self(db))
    }
    pub fn begin_read(&self) -> Result<Transaction> {
        Ok(Transaction::Read(self.0.begin_read()?))
    }
    pub fn begin_write(&self) -> Result<Transaction> {
        Ok(Transaction::Write(self.0.begin_write()?))
    }
}
impl Transaction {
    pub fn open_table(&self) -> Result<Table<'_>> {
        Ok(match self {
            Self::Read(tx) => Table::Read(tx.open_table(TABLE)?),
            Self::Write(tx) => Table::Write(tx.open_table(TABLE)?),
        })
    }
    pub fn commit(self) -> Result<()> {
        if let Self::Write(tx) = self {
            tx.commit()?;
        }
        Ok(())
    }
}
impl Table<'_> {
    pub fn get(&self, key: &[u8]) -> Result<Option<Bytes<'_>>> {
        Ok(match self {
            Self::Read(t) => t.get(key)?.map(Bytes::Guard),
            Self::Write(t) => t.get(key)?.map(Bytes::Guard),
        })
    }
    pub fn insert(&mut self, key: &[u8], value: &[u8]) -> Result<()> {
        match self {
            Self::Write(t) => {
                t.insert(key, value)?;
            }
            _ => anyhow::bail!("read-only transaction"),
        }
        Ok(())
    }
    pub fn remove(&mut self, key: &[u8]) -> Result<()> {
        match self {
            Self::Write(t) => {
                t.remove(key)?;
            }
            _ => anyhow::bail!("read-only transaction"),
        }
        Ok(())
    }
    pub fn range(
        &self,
        start: Bound<&[u8]>,
        prefix: &[u8],
        limit: usize,
    ) -> Result<Vec<(Bytes<'static>, Bytes<'static>)>> {
        fn scan<T: ReadableTable<&'static [u8], &'static [u8]>>(
            table: &T,
            start: Bound<&[u8]>,
            prefix: &[u8],
            limit: usize,
        ) -> Result<Vec<(Bytes<'static>, Bytes<'static>)>> {
            let mut results = Vec::new();
            let mut size = 0;
            for row in table.range((start, Bound::Unbounded))? {
                let (key, value) = row?;
                if !key.value().starts_with(prefix) {
                    break;
                }
                size += value.value().len();
                results.push((
                    Bytes::Owned(key.value().to_vec()),
                    Bytes::Owned(value.value().to_vec()),
                ));
                if results.len() == limit || size > super::MAX_PAGE + super::MAX_VALUE + 8192 {
                    break;
                }
            }
            Ok(results)
        }
        match self {
            Self::Read(t) => scan(t, start, prefix, limit),
            Self::Write(t) => scan(t, start, prefix, limit),
        }
    }
}
