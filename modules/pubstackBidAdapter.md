# Overview

```
Module Name: Pubstack Bidder Adapter
Module Type: Bidder Adapter
Maintainer: prebid@pubstack.io
```

# Description
Module that connects to the Pubstack bidder to request bids via OpenRTB.

# Test Parameters
```
var adUnits = [{
  code: 'pubstack-adunit-1',
  mediaTypes: {
    banner: {
      sizes: [[300, 250]]
    }
  },
  bids: [{
    bidder: 'pubstack',
    params: {
      siteId: 'test-site-id',
      adUnitName: 'test-adunit-name'
    }
  }]
}];
```