'use strict';

const { assert, expect } = require('chai');

const DEFAULT_TIMEOUT_MS = 4e3;
const { Fixture } = require('./fixture_hw5p1');


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

  context('field: initial_balance_usd_cents', function () {    
    it('set if valid, integer digit', async () => {
      const val = 1000;
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
        return fix.test_fail(DEFAULT_METHOD, DEFAULT_PATH, ps, 422, 'balance_usd_cents');
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

  context('amount_usd_cents', function () {
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
      const test_vals = [121, 12, 10, 1];
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
      const test_vals = [
        -1000,
        100.1,
        'one'
      ];

      return Promise.map(test_vals, async val => {
        const pid = await fix._player_create();
        await fix.test_fail(DEFAULT_METHOD, DEFAULT_PATH(pid), { amount_usd_cents: val }, 400);
      });
    });
  });
});
