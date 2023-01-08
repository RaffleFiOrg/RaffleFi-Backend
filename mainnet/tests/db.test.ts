import { expect } from "chai"
import { PoolConnection } from "mariadb"
import { pool } from "../db"

let db: PoolConnection
describe('db', () => {
    beforeEach(async () => {
        db = await pool.getConnection()
    })

    it('gets the whitelisted currencies', async () => {
        const rows = await db.query(`SELECT * FROM currencies;`)
        expect(rows).to.not.be.null
        if (db) db.release()
    })

    it('gets the correct token', async () => {
        const rows = await db.query(`SELECT name FROM currencies WHERE address=?;`,
            ["0x098A97265e0a9F227514E39Bc7E0ffCD98bd41a7"]
        )
        expect(rows[0]['name']).to.be.eq('WETH')
        if (db) db.release()
    })
})