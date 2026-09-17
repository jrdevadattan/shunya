use rusqlite::Connection;
use std::path::Path;

const INITIAL_MIGRATION: &str = include_str!("../migrations/0001_initial.sql");

pub fn create(path: &Path) -> rusqlite::Result<Connection> {
    let connection = Connection::open(path)?;
    configure(&connection)?;
    connection.execute_batch(INITIAL_MIGRATION)?;
    Ok(connection)
}

pub fn open(path: &Path) -> rusqlite::Result<Connection> {
    let connection = Connection::open(path)?;
    configure(&connection)?;
    Ok(connection)
}

fn configure(connection: &Connection) -> rusqlite::Result<()> {
    connection
        .execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;")
}
