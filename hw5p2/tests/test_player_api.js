'use strict';

const { assert, expect } = require('chai');

const DEFAULT_TIMEOUT_MS = 4e3;
const { Fixture } = require('./fixture_hw5p2');


describe('POST /player', function() {
  const DEFAULT_PATH   = Fixture.URL_MAP.PLAYER_CREATE.path;
  const DEFAULT_METHOD = Fixture.URL_MAP.PLAYER_CREATE.method;

  this.timeout(DEFAULT_TIMEOUT_MS);

  const fix = new Fixture();

  before(() => fix.before());
  after(() => fix.after());

  
  context('response', function () {
    it('response_code is 303 on success', async () => {
      const ps = fix.post_player_param();
      return fix.test_forward(DEFAULT_METHOD, DEFAULT_PATH, ps, 303);
    });
  });

  context('field: pid', function () {
    it('is ObjectId', async () => {
      const ps = fix.post_player_param();
      const { body } = await fix.test_forward(DEFAULT_METHOD, DEFAULT_PATH, ps, 303);
      
      const { pid } = JSON.parse(body);
      const player = await fix._player_get(pid);

      expect(player).to.have.property('_id');
      expect(player._id).to.be.an.ObjectId;
    });
  });

  // FNAME + LNAME
  context('field: name', function () {
    it('fname + lname', async () => {
      const fname = 'player';
      const lname = 'last';
      const ps = fix.post_player_param({ fname, lname });
      return fix.test_forward(DEFAULT_METHOD, DEFAULT_PATH, ps, 303, { name: `${fname} ${lname}` });
    });
    
    it('fname blank', async () => {
      const fname = '';
      const ps = fix.post_player_param({ fname });
      return fix.test_fail(DEFAULT_METHOD, DEFAULT_PATH, ps, 422, 'fname');
    });
    
    it('fname invalid char', async () => {
      const fname = 'player1';
      const ps = fix.post_player_param({ fname });
      return fix.test_fail(DEFAULT_METHOD, DEFAULT_PATH, ps, 422, 'fname');
    });

    it('fname invalid space', async () => {
      const fname = 'player player';
      const ps = fix.post_player_param({ fname });
      return fix.test_fail(DEFAULT_METHOD, DEFAULT_PATH, ps, 422, 'fname');
    });
  });

  context('field: handed', function () {
    it('accept valid enum', () => {
      const vals = ['left', 'right', 'ambi'];

      return Promise.map(vals, val => {
        const ps = fix.post_player_param({ handed: val });
        return fix.test_forward(DEFAULT_METHOD, DEFAULT_PATH, ps, 303, { handed: val });
      });
    });

    it('no-accept invalid enum', () => {
      const vals = ['L', 'R'];

      return Promise.map(vals, val => {
        const ps = fix.post_player_param({ handed: val });
        return fix.test_fail(DEFAULT_METHOD, DEFAULT_PATH, ps, 422, 'handed');
      });
    });
  });

  context('field: initial_balance_usd_cents', function () {
    it('set if valid, integer digit', async () => {
      const val = 1013;
      const ps = fix.post_player_param({ initial_balance_usd_cents: val });
      return fix.test_forward(DEFAULT_METHOD, DEFAULT_PATH, ps, 303, { balance_usd_cents: val });
    });

    it('fail if invalid', async () => {
      const test_vals = [
        -1000,
        100.1
      ];
  
      return Promise.map(test_vals, async val => {
        const ps = fix.post_player_param({ initial_balance_usd_cents: val });
      });
    });
  });
  
  context('field: is_active', function () {
    it('default is_active=true', async () => {
      const ps = fix.post_player_param();
      return fix.test_forward(DEFAULT_METHOD, DEFAULT_PATH, ps, 303, { is_active: true });
    });
  });
  
  context('field: created_at', function () {
    it('created_at set', async () => {
      const pid = await fix.post_player();

      const player = await fix._player_get(pid);

      expect(player).to.have.property('created_at');
      expect(player.created_at).to.be.instanceof(Date);
    });
  });
});


describe('POST /player/:pid', function() {
  const DEFAULT_PATH   = Fixture.URL_MAP.PLAYER_UPDATE.path;
  const DEFAULT_METHOD = Fixture.URL_MAP.PLAYER_UPDATE.method;

  this.timeout(DEFAULT_TIMEOUT_MS);

  const fix = new Fixture();

  before(() => fix.before());
  after(() => fix.after());

  
  context('pid exist', function () {
    it('response_code is 303', async () => {
      const pid = await fix._player_create();
      return fix.test_forward(DEFAULT_METHOD, DEFAULT_PATH(pid), {}, 303);
    });
  });
  
  context('pid not exist', function() {
    it('response code is 404', function () {
      const pid = fix.random_id();
      return fix.test_fail(DEFAULT_METHOD, DEFAULT_PATH(pid), {}, 404);
    });
  });

  context('field: lname', function () {
    it('response code is 303', async function () {
      let lname = 'lname';

      const pid = await fix._player_create({ lname });

      lname = 'lnamep';
      return fix.test_forward(DEFAULT_METHOD, DEFAULT_PATH(pid), { lname }, 303);
    });

    it('update', async function () {
      const fname = 'pp';
      let lname = 'lname';

      const pid = await fix._player_create({ fname, lname });

      lname = 'lnamep';
      return fix.test_forward(DEFAULT_METHOD, DEFAULT_PATH(pid), { lname }, 303, { name: `${fname} ${lname}` });
    });
    
    it('update to same', async function () {
      const fname = 'pp';
      let lname = 'lname';

      const pid = await fix._player_create({ fname, lname });

      lname = 'lname';
      return fix.test_forward(DEFAULT_METHOD, DEFAULT_PATH(pid), { lname }, 303, { name: `${fname} ${lname}` });
    });
    
    it('update to empty', async function () {
      const fname = 'pp';
      let lname = 'lname';

      const pid = await fix._player_create({ fname, lname });

      lname = '';
      return fix.test_forward(DEFAULT_METHOD, DEFAULT_PATH(pid), { lname }, 303, { name: `${fname}` });
    });
  });

  context('field: active', function () {
    it('active => inactive', async function () {
      const pid = await fix._player_create();
      return fix.test_forward(DEFAULT_METHOD, DEFAULT_PATH(pid), { active: 'f' }, 303, { is_active: false });
    });
    
    it('inactive => active', async function () {
      const pid = await fix._player_create();
      await fix.test_forward(DEFAULT_METHOD, DEFAULT_PATH(pid), { active: 'f' }, 303, { is_active: false });
      return fix.test_forward(DEFAULT_METHOD, DEFAULT_PATH(pid), { active: 't' }, 303, { is_active: true });
    });
    
    it('validate true boolean input', function () {
      const test_vals = ['1', 't', 'true', 'T', 'TRUE'];

      return Promise.map(test_vals, async val => {
        const pid = await fix._player_create();
        // deactivate
        await fix.test_forward(DEFAULT_METHOD, DEFAULT_PATH(pid), { active: 'f' }, 303, { is_active: false });
        // re-activate
        const { body } = await fix.test_forward(DEFAULT_METHOD, DEFAULT_PATH(pid), { active: val }, 303);
        const { is_active } = JSON.parse(body);
        expect(is_active).to.be.a('boolean').and.equal(true);
      });
    });

    context('field: created_at', async () => {    
      it('created_at no change on update', async () => {
        let lname = 'lname';
  
        const pid = await fix._player_create({ lname });
  
        const { created_at: createdAt1 } = await fix._player_get(pid);
  
        lname = 'lnamep';
        await fix.test_forward(
          Fixture.URL_MAP.PLAYER_UPDATE.method,
          Fixture.URL_MAP.PLAYER_UPDATE.path(pid),
          {
            lname
          }, 303);
  
        const { created_at: createdAt2, lname: lname2 } = await fix._player_get(pid);
  
        expect(lname2).to.equal(lname);
        expect(createdAt2).to.equal(createdAt1);
      });
    });
  });
});


describe('POST /deposit/player/:pid', function() {
  const DEFAULT_PATH   = Fixture.URL_MAP.PLAYER_DEPOSIT.path;
  const DEFAULT_METHOD = Fixture.URL_MAP.PLAYER_DEPOSIT.method;

  this.timeout(DEFAULT_TIMEOUT_MS);

  const fix = new Fixture();

  before(() => fix.before());
  after(() => fix.after());

  
  context('pid exist', function () {
    it('response_code is 200', async () => {
      const pid = await fix._player_create();
      return fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH(pid), { amount_usd_cents: 0 }, 200);
    });

    it('response is balance_usd_cents model', async function () {
      const pid = await fix._player_create();
      const { body } = await fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH(pid), { amount_usd_cents: 0 }, 200);
      
      const d = JSON.parse(body);
      expect(d).to.be.a.model('player_balance');
    });
  });
  
  context('pid not exist', function() {
    it('response code is 404', function () {
      const pid = fix.random_id();
      return fix.test_fail(DEFAULT_METHOD, DEFAULT_PATH(pid), { amount_usd_cents: 0 }, 404);
    });
  });

  context('amount_usd', function () {
    it('incremement zero balance', async function() {
      const balance_usd_cents = 0;
      const amount_usd_cents = 123;
      const pid = await fix._player_create({ balance_usd_cents });
      return fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH(pid), { amount_usd_cents }, 200, { old_balance_usd_cents: balance_usd_cents, new_balance_usd_cents: amount_usd_cents });
    });
    
    it('incremement non-zero balance', async function() {
      const balance_usd_cents = 100;
      const amount_usd_cents = 123;
      const pid = await fix._player_create({ balance_usd_cents });
      const new_balance_usd_cents = balance_usd_cents + amount_usd_cents;
      return fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH(pid), { amount_usd_cents }, 200, { old_balance_usd_cents: balance_usd_cents, new_balance_usd_cents });
    });

    it('allow zero deposit', function() {
      const test_vals = [0];
      const balance_usd_cents = 100;

      return Promise.map(test_vals, async val => {
        const pid = await fix._player_create({ balance_usd_cents });
        await fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH(pid), { amount_usd_cents: val }, 200, { old_balance_usd_cents: balance_usd_cents, new_balance_usd_cents: balance_usd_cents });
      });
    });
    
    it('allow valid currency', function() {
      const test_vals = [121];
      const balance_usd_cents = 100;

      return Promise.map(test_vals, async val => {
        const pid = await fix._player_create({ balance_usd_cents });
        const new_balance_usd_cents = balance_usd_cents + val;
        await fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH(pid), { amount_usd_cents: val }, 200, { new_balance_usd_cents });
      });
    });
    
    it('400 if empty amount_usd_cents', async function() {
      const pid = await fix._player_create();
      await fix.test_fail(DEFAULT_METHOD, DEFAULT_PATH(pid), {}, 400);
    });
    
    it('400 if invalid currency', function() {
      const test_vals = ['one', -100, 100.1];

      return Promise.map(test_vals, async val => {
        const pid = await fix._player_create();
        await fix.test_fail(DEFAULT_METHOD, DEFAULT_PATH(pid), { amount_usd_cents: val }, 400);
      });
    });
  });
});


describe('DELETE /player/:pid', function() {
  const DEFAULT_PATH   = Fixture.URL_MAP.PLAYER_DELETE.path;
  const DEFAULT_METHOD = Fixture.URL_MAP.PLAYER_DELETE.method;

  this.timeout(DEFAULT_TIMEOUT_MS);

  const fix = new Fixture();

  before(() => fix.before());
  after(() => fix.after());

  context('pid exist', () => {
    it('response_code is 303 on success', async () => {
      const pid = await fix._player_create();
      await fix.test_forward(DEFAULT_METHOD, DEFAULT_PATH(pid), {}, 303);
    });

    it('pid deleted', async () => {
      const pid = await fix._player_create();
      return fix.test_forward(DEFAULT_METHOD, DEFAULT_PATH(pid), {}, 303);
    });

    it('pid deleted x2', async () => {
      const pid = await fix._player_create();
      await fix.test_forward(DEFAULT_METHOD, DEFAULT_PATH(pid), {}, 303);
      await fix.test_fail(DEFAULT_METHOD, DEFAULT_PATH(pid), {}, 404);
    });
  });


  context('pid not exist', function() {
    it('response code is 404', function () {
      const pid = fix.random_id();
      return fix.test_fail(DEFAULT_METHOD, DEFAULT_PATH(pid), {}, 404);
    });
  });
});
