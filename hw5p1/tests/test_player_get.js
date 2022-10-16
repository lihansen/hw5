'use strict';

const { assert, expect } = require('chai');

const DEFAULT_TIMEOUT_MS = 4e3;
const { Fixture } = require('./fixture_hw5p1');


describe('GET /player', function() {
  const DEFAULT_PATH   = Fixture.URL_MAP.PLAYER_LIST.path;
  const DEFAULT_METHOD = Fixture.URL_MAP.PLAYER_LIST.method;

  this.timeout(DEFAULT_TIMEOUT_MS);

  const fix = new Fixture();

  beforeEach(() => fix._db_flush());

  before(() => fix.before());
  after(() => fix.after());

  
  context('contains 1 player', () => {
    it('response code is 200', async function () {
      await fix._player_create();
      return fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH, {}, 200);
    });

    it('response is array length 1', async function () {
      await fix._player_create();
      const { body } = await fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH, {}, 200);
      
      const d = JSON.parse(body);
      expect(d).to.be.an('array').with.length(1);

      for (const obj of d) {
        expect(obj).to.be.a.model('player');
      }
    });
  });

  
  context('contains 2+ player', () => {
    it('response code is 200', async function () {
      await Promise.all([
        fix._player_create(),
        fix._player_create()
      ]);
      return fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH, {}, 200);
    });

    it('response is array length 2', async function () {
      await Promise.all([
        fix._player_create(),
        fix._player_create()
      ]);
      const { body } = await fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH, {}, 200);
      
      const d = JSON.parse(body);
      expect(d).to.be.an('array').with.length(2);

      for (const obj of d) {
        expect(obj).to.be.a.model('player');
      }
    });
  });
});


describe('GET /player/:pid', function() {
  const DEFAULT_PATH   = Fixture.URL_MAP.PLAYER_GET.path;
  const DEFAULT_METHOD = Fixture.URL_MAP.PLAYER_GET.method;

  this.timeout(DEFAULT_TIMEOUT_MS);

  const fix = new Fixture();

  before(() => fix.before());
  after(() => fix.after());


  context('pid exist', () => {
    it('response code is 200', async () => {
      const pid = await fix._player_create();
      return fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH(pid), {}, 200);
    });

    it('response is valid player', async () => {
      const pid = await fix._player_create();
      const { body } = await fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH(pid), {}, 200);

      const d = JSON.parse(body);
      expect(d).to.be.a.model('player');
    });
  });


  context('field: balance_usd_cents', () => {
    it('response contains balance_usd_cents', async () => {
      const pid = await fix._player_create();
      return fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH(pid), {}, 200, ['balance_usd_cents']);
    });
    
    it('balance_usd_cents is currency', async () => {
      const balance_usd_cents = 1234;
      const pid = await fix._player_create({ balance_usd_cents });
      return fix.test_succeed(DEFAULT_METHOD, DEFAULT_PATH(pid), {}, 200, { balance_usd_cents });
    });
  });
});
