export async function findBreed(db: { query: (sql: string) => Promise<unknown> }, name: string) {
  return db.query("SELECT * FROM breeds WHERE name = '" + name + "'");
}

