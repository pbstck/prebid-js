import { expect } from 'chai';
import { spec } from 'modules/pubstackBidAdapter';
import * as utils from 'src/utils.js';
import { hook } from 'src/hook.js';
import 'src/prebid.js';
import 'modules/consentManagementTcf.js';
import 'modules/consentManagementUsp.js';
import 'modules/consentManagementGpp.js';

describe('pubstackBidAdapter', function () {
  const bidRequests = [
    {
      adUnitCode: 'adunit-code',
      auctionId: 'auction-1',
      bidId: 'bid-1',
      bidder: 'pubstack',
      bidderRequestId: 'request-1',
      mediaTypes: { banner: { sizes: [[300, 250]] } },
      params: {
        siteId: 'site-123',
        adUnitName: 'adunit-1'
      },
      sizes: [[300, 250]],
      transactionId: 'transaction-1'
    }
  ];

  const bidderRequest = {
    bids: bidRequests,
    gdprConsent: {
      gdprApplies: true,
      consentString: 'consent-string',
      vendorData: {
        purpose: {
          consents: { 1: true }
        }
      }
    },
    uspConsent: '1YYN',
    gppConsent: {
      gppString: 'gpp-string',
      applicableSections: [7, 8]
    },
    refererInfo: {
      referer: 'https://example.com'
    }
  };

  before(() => {
    hook.ready();
  });

  describe('isBidRequestValid', function () {
    it('returns true when required params are present', function () {
      const bid = {
        params: {
          siteId: 'site-123',
          adUnitName: 'adunit-1'
        }
      };
      expect(spec.isBidRequestValid(bid)).to.equal(true);
    });

    it('returns false when siteId is missing', function () {
      const bid = {
        params: {
          adUnitName: 'adunit-1'
        }
      };
      expect(spec.isBidRequestValid(bid)).to.equal(false);
    });

    it('returns false when adUnitName is missing', function () {
      const bid = {
        params: {
          siteId: 'site-123'
        }
      };
      expect(spec.isBidRequestValid(bid)).to.equal(false);
    });
  });

  describe('buildRequests', function () {
    it('builds a single POST request with ORTB data and consent flags', function () {
      const request = spec.buildRequests(bidRequests, bidderRequest);

      expect(request.method).to.equal('POST');
      expect(request.url).to.equal('https://prebid-server.pbstck.com/auction');
      expect(utils.deepAccess(request, 'data.site.publisher.id')).to.equal('site-123');
      expect(utils.deepAccess(request, 'data.regs.ext.gdpr')).to.equal(1);
      expect(utils.deepAccess(request, 'data.user.ext.consent')).to.equal('consent-string');
      expect(utils.deepAccess(request, 'data.regs.ext.us_privacy')).to.equal('1YYN');
      expect(utils.deepAccess(request, 'data.regs.ext.gpp')).to.equal('gpp-string');
      expect(utils.deepAccess(request, 'data.regs.ext.gpp_sid')).to.deep.equal([7, 8]);
      expect(utils.deepAccess(request, 'data.ext.prebid')).to.deep.equal({});

      expect(request.data.imp).to.have.lengthOf(1);
      expect(utils.deepAccess(request, 'data.imp.0.ext.pubstack.siteId')).to.equal('site-123');
      expect(utils.deepAccess(request, 'data.imp.0.ext.pubstack.adUnitName')).to.equal('adunit-1');
      expect(utils.deepAccess(request, 'data.imp.0.ext.pubstack.version')).to.equal('1.0');
      expect(utils.deepAccess(request, 'data.imp.0.id')).to.equal('adunit-1');
      expect(utils.deepAccess(request, 'data.imp.0.ext.prebid.bidder.pubstack.adUnitName')).to.equal('adunit-1');
    });
  });

  describe('interpretResponse', function () {
    it('returns empty array when response has no body', function () {
      const request = spec.buildRequests(bidRequests, bidderRequest);
      const bids = spec.interpretResponse({ body: null }, request);
      expect(bids).to.be.an('array').that.is.empty;
    });

    it('maps ORTB responses to Prebid bids', function () {
      const request = spec.buildRequests(bidRequests, bidderRequest);
      const serverResponse = {
        body: {
          id: 'resp-1',
          cur: 'USD',
          seatbid: [
            {
              bid: [
                {
                  impid: 'adunit-1',
                  price: 1.23,
                  w: 300,
                  h: 250,
                  adm: '<div>ad</div>',
                  crid: 'creative-1'
                }
              ]
            }
          ]
        }
      };

      const bids = spec.interpretResponse(serverResponse, request);
      expect(bids).to.have.lengthOf(1);
      expect(bids[0]).to.include({
        requestId: 'adunit-1',
        cpm: 1.23,
        width: 300,
        height: 250,
        ad: '<div>ad</div>',
        creativeId: 'creative-1'
      });
      expect(bids[0]).to.have.property('currency', 'USD');
    });
  });

  describe('getUserSyncs', function () {
    it('returns iframe sync when consent and siteId are available', function () {
      spec.buildRequests(bidRequests, bidderRequest);
      const syncs = spec.getUserSyncs(
        { iframeEnabled: true, pixelEnabled: false },
        [{}],
        bidderRequest.gdprConsent,
        bidderRequest.uspConsent,
        bidderRequest.gppConsent
      );

      expect(syncs).to.have.lengthOf(1);
      expect(syncs[0].type).to.equal('iframe');
      expect(syncs[0].url).to.include('account:site-123');
      expect(syncs[0].url).to.include('gdpr_consent=consent-string');
    });
  });
});
