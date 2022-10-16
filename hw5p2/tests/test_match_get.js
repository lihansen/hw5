'use strict';

const { assert, expect } = require('chai');

const DEFAULT_TIMEOUT_MS = 4e3;
const { Fixture } = require('./fixture_hw5p2');


describe('GET /match', function() {
  const DEFAULT_PATH   = Fixture.URL_MAP.MATCH_LIST.path;
  const DEFAULT_METHOD = Fixture.URL_MAP.MATCH_LIST.method;

  this.timeout(DEFAULT_TIMEOUT_MS);

  const fix = new Fixture();

  beforeEach(() => fix._db_flush());

  before(() => fix.before());
  after(() => fix.after());

  
  context('contains 0 match', () => {
    it('response code is 200', async function () {
      return fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH, {}, 200);
    });

    it('response is empty array', async function () {
      const { body } = await fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH, {}, 200);
      
      const d = JSON.parse(body);
      expect(d).to.be.an('array').with.length(0);
    });
  });

  
  context('contains 1 match', () => {
    it('response code is 200', async function () {
      await fix._match_create();
      return fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH, {}, 200);
    });

    it('response is array length 1', async function () {
      await fix._match_create();
      const { body } = await fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH, {}, 200);
      
      const d = JSON.parse(body);
      expect(d).to.be.an('array').with.length(1);

      for (const obj of d) {
        expect(obj).to.be.a.model('match');
      }
    });
  });

  
  context('contains 2+ match', () => {
    it('response code is 200', async function () {
      await Promise.all([
        fix._match_create(),
        fix._match_create()
      ]);
      return fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH, {}, 200);
    });

    it('response is array length 2', async function () {
      await Promise.all([
        fix._match_create(),
        fix._match_create()
      ]);
      const { body } = await fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH, {}, 200);
      
      const d = JSON.parse(body);
      expect(d).to.be.an('array').with.length(2);

      for (const obj of d) {
        expect(obj).to.be.a.model('match');
      }
    });
  });
  

  context('sort match', function () {
    it('active, prize_usd DESC', async function () {
      // insert in order
      const vals = [
        600,
        500,
        700,
        100,
        900
      ];
      const sorted_vals = vals.sort().reverse();

      await Promise.map(vals, prize_usd_cents => fix._match_create({ prize_usd_cents }));

      const { body } = await fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH, {}, 200);
      const objs = JSON.parse(body);

      const prize_usd_centss = objs.map(({ prize_usd_cents }) => prize_usd_cents);
      expect(prize_usd_centss).to.deep.equal(sorted_vals);
    });


    it('at most 4 not-active', async function () {
      const EXP_MAX_LENGTH = 4;
      
      // insert in order
      const vals = [
        600,
        500,
        700,
        100,
        900
      ];

      const ids = await Promise.map(vals, prize_usd_cents => fix._match_create({ prize_usd_cents }));
      await Promise.map(ids, async ({ mid, p1_id }) => {
        await fix.post_match_award(mid, p1_id);
        await fix.post_match_end(mid);
      });

      const { body } = await fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH, {}, 200);
      const objs = JSON.parse(body);

      expect(objs).to.have.length(Math.min(EXP_MAX_LENGTH, vals.length));
    });


    it('active before not-active', async function () {      
      // insert in order
      const vals = [
        100,
        600,
        500,
        700
      ];

      const ids = await Promise.map(vals, prize_usd_cents => fix._match_create({ prize_usd_cents }));

      const not_active_ids = [ids[1], ids[2]];
      // const active_mids = [ids[0], ids[3]];
      // active only, indexes match above, manual sort based on vals
      const sorted_active_mids = [ids[3].mid, ids[0].mid];
      const not_active_mids = [ids[1].mid, ids[2].mid];

      await Promise.map(not_active_ids, async ({ mid, p1_id }) => {
        await fix.post_match_award(mid, p1_id);
        await fix.post_match_end(mid);
      });

      const { body } = await fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH, {}, 200);
      const objs = JSON.parse(body);

      const mids = objs.map(({ mid }) => mid);
      expect(mids.slice(0, 2)).to.deep.equal(sorted_active_mids);
      expect(mids.slice(2, 4)).to.deep.members(not_active_mids);
    });
  });
});


describe('GET /match/:mid', function() {
  const DEFAULT_PATH   = Fixture.URL_MAP.MATCH_GET.path;
  const DEFAULT_METHOD = Fixture.URL_MAP.MATCH_GET.method;

  this.timeout(DEFAULT_TIMEOUT_MS);

  const fix = new Fixture();

  before(() => fix.before());
  after(() => fix.after());


  context('mid exist', () => {
    it('response code is 200', async () => {
      const { mid } = await fix._match_create();
      return fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH(mid), {}, 200);
    });

    it('response is valid match', async () => {
      const { mid } = await fix._match_create();
      const { body } = await fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH(mid), {}, 200);

      const d = JSON.parse(body);
      expect(d).to.be.a.model('match');
    });
  });


  context('mid not exist', function() {
    it('response code is 404', function () {
      return fix.test_fail(DEFAULT_METHOD, DEFAULT_PATH(999), {}, 404);
    });
  });


  context('mid', function () {
    it('response contains mid', async function () {
      const { mid } = await fix._match_create();
      return fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH(mid), {}, 200, ['mid']);
    });

    it('mid is ObjectId', async function () {
      const { mid } = await fix._match_create();
      const { body } = await fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH(mid), {}, 200);
      
      const { mid: _mid } = JSON.parse(body);
      expect(_mid).to.be.ObjectIdString.and.equal(mid);
    });


    context('id', function () {
      it('response contains ids', async function () {
        const { mid } = await fix._match_create();
        return fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH(mid), {}, 200, ['p1_id', 'p2_id']);
      });
  
  
      it('ids match player', async function () {
        const [p1_id, p2_id] = await Promise.all([
          fix._player_create(),
          fix._player_create()
        ]);
  
        const { mid } = await fix._match_create({ p1_id, p2_id });
        const { body } = await fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH(mid), {}, 200);
        
        const { p1_id: _p1_id, p2_id: _p2_id } = JSON.parse(body);
        
        expect(_p1_id).to.be.ObjectIdString.and.equal(p1_id);
        expect(_p2_id).to.be.ObjectIdString.and.equal(p2_id);
      });
    });


    context('name', function () {
      it('response contains names', async function () {
        const { mid } = await fix._match_create();
        return fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH(mid), {}, 200, ['p1_name', 'p2_name']);
      });
  
  
      it('names match player', async function () {
        const PLAYER1_FNAME = 'pp';
        const PLAYER1_LNAME = 'pplast';
        const PLAYER2_FNAME = 'qq';
        const PLAYER2_LNAME = 'qqlast';
  
        const [p1_id, p2_id] = await Promise.all([
          fix._player_create({ fname:PLAYER1_FNAME, lname:PLAYER1_LNAME }),
          fix._player_create({ fname:PLAYER2_FNAME, lname:PLAYER2_LNAME }),
        ]);
  
        const { mid } = await fix._match_create({ p1_id, p2_id });
        return fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH(mid), {}, 200, {
          p1_name: `${PLAYER1_FNAME} ${PLAYER1_LNAME}`,
          p2_name: `${PLAYER2_FNAME} ${PLAYER2_LNAME}`
        });
      });
    });


    context('is_active', function () {
      it('response contains is_active', async function () {
        const { mid } = await fix._match_create();
        return fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH(mid), {}, 200, ['is_active']);      
      });
  
      it('is_active is boolean', async function () {
        const { mid } = await fix._match_create();
        const { body } = await fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH(mid), {}, 200);
        
        const { is_active } = JSON.parse(body);
        expect(is_active).to.be.a('boolean').and.equal(true);
      });
    });
  
  
    context('prize_usd_cents', function () {
      it('response contains prize_usd_cents', async function () {
        const { mid } = await fix._match_create();
        return fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH(mid), {}, 200, ['prize_usd_cents']);
      });
  
      it('total_prize is currency', async function () {
        const prize_usd_cents = 543;
        const { mid } = await fix._match_create({ prize_usd_cents });
        return fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH(mid), {}, 200, { prize_usd_cents });
      });
    });


    context('points', function () {
      it('response contains points', async function () {
        const { mid } = await fix._match_create();
        return fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH(mid), {}, 200, ['p1_points', 'p2_points']);
      });
  
  
      it('points is int', async function () {
        const { mid } = await fix._match_create();
        const { body } = await fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH(mid), {}, 200);
        
        const { p1_points, p2_points } = JSON.parse(body);
        expect(p1_points).to.be.a('number').and.equal(0);
        expect(p1_points % 1).to.be.equal(0);
        expect(p2_points).to.be.a('number').and.equal(0);
        expect(p2_points % 1).to.be.equal(0);
      });
    });
  
  
    context('winner_pid', function () {
      it('response contains winner_pid', async function () {
        const { mid } = await fix._match_create();
        return fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH(mid), {}, 200, ['winner_pid']);
      });
  
  
      it('(active) winner_pid is null', async function () {
        const { mid } = await fix._match_create();
        const { body } = await fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH(mid), {}, 200);
        
        const { winner_pid } = JSON.parse(body);
        expect(winner_pid).to.be.null;
      });
  
  
      it('(complete) winner_pid is ObjectId', async function () {
        const { mid, p1_id, p2_id } = await fix._match_create();
        // disqualify to end
        await fix.post_match_dq(mid, p1_id);
  
        const { body } = await fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH(mid), {}, 200);
        
        const { winner_pid } = JSON.parse(body);
        expect(winner_pid).to.be.ObjectIdString.and.equal(p2_id);
      });
    });
  });

  context('ended_at', function () {
    it('response contains ended_at', async function () {
      const { mid, p1_id } = await fix._match_create();
      return fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH(mid), {}, 200, ['ended_at']);
    });


    it('(active) ended_at is null', async function () {
      const { mid } = await fix._match_create();
      const { body } = await fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH(mid), {}, 200);
      
      const { ended_at } = JSON.parse(body);
      expect(ended_at).to.be.null;
    });


    it('(complete) ended_at is datetime string', async function () {
      const { mid, p1_id } = await fix._match_create();
      // disqualify to end
      await fix.post_match_dq(mid, p1_id);

      const { body } = await fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH(mid), {}, 200);
      
      const { ended_at } = JSON.parse(body);
      expect(ended_at).to.be.valid.iso8601;
    });
  });


  context('age', function () {
    it('response contains age', async function () {
      const { mid } = await fix._match_create();
      return fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH(mid), {}, 200, ['age']);
    });


    it('age is int', async function () {
      const { mid } = await fix._match_create();
      const { body } = await fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH(mid), {}, 200);

      const { age } = JSON.parse(body);
      // assuming test within 2 sec
      expect(age).to.be.a('number').most(2);
      expect(age % 1).to.be.equal(0);
    });
  });
});
