/* -*- coding: utf-8 -*-
============================================================================= */
/*jshint asi: true*/

var debug = require('debug')('nmcns:server');

var util = require('util');
var nmcpp = require('nmcpp');
var nmcns = require('nmcns');
var dns = require('native-dns');

var httpRequest = require('request');
var urljoin = require('url-join');

/* Dnschain Provider
============================================================================= */

var DnschainProvider = nmcpp.Provider.extend({
    init: function(opts) {
        nmcpp.Provider.prototype.init.apply(this, arguments);
        this.addr = opts.addr;
    },
    load: function(name, callback) {
        httpRequest({
            method: 'GET',
            url: util.format(this.addr, name),
            headers: { 'Accept': 'application/json' }
        }, function(error, response, body) {
            if (error || response.statusCode != 200) {
                return callback(new Error(error || response.statusCode));
            }
            return nmcpp.parseJson(body, callback);
        });
    }
});

/* Steem Provider
============================================================================= */

var SteemProvider = nmcpp.Provider.extend({
    init: function(opts) {
        nmcpp.Provider.prototype.init.apply(this, arguments);
        this.addr = opts.addr;
    },
    load: function(name, callback) {
        var [ tp, nm ] = name.split('/');
        var data = {
            "jsonrpc": "2.0",
            "method": "call",
            "params": [
                "database_api",
                "get_accounts",
                [[nm]]
            ],
            "id": 1
        };
        httpRequest({
            method: 'POST',
            url: this.addr,
            body: data,
            json: true,
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
        }, function(error, response, data) {
            if (error || response.statusCode != 200) {
                return callback(new Error(error || response.statusCode));
            }
            if (!('result' in data)) {
                return callback(new Error('There is no "result" field in response'));
            }
            var result = (data.result)[0];
            if (!('json_metadata' in result)) {
                return callback(new Error('There is no "json_metadata" field in response'));
            }
            return nmcpp.parseJson(result.json_metadata, function(err, res) {
                if (err) { return callback(err); }
                return callback(undefined, res[tp]);
            });
        });
    }
});

/* Namecoin Provider
============================================================================= */

var dnschain = 'https://dnschain.info/bit/%s';

new DnschainProvider({
    addr: dnschain
});

new DnschainProvider({
    addr: dnschain,
    gtld: 'plex',
    transform: function(name) {
        return 'plex-net-' + name;
    }
});

/* Steem Provider
============================================================================= */

var steemd = 'https://steem.vilijavis.lt';

new SteemProvider({
    addr: steemd,
    gtld: 'steem'
});

/* Test Provider
============================================================================= */

new nmcpp.TestProvider({
    debug: debug,
    gtld: 'test'
}, {
    "d/example": {
        "map": {
            "us": {
                "email": "alice@example.bit",
                "ip": ["8.8.8.8", "8.8.4.4"],
                "ip6": ["2001:4860:4860::8888", "2001:4860:4860::8844"],
                "info": ["v=spf1 include:_spf.google.com ~all"],
                "service": [
                    [ "domain", "udp", 10, 0, 53, "ns.@" ],
                    [ "smtp", "tcp", 10, 0, 25, "ASPMX.L.GOOGLE.COM." ],
                ],
            },
            "*": {
                "alias": "us.@"
            }
        }
    }
});

/* Resolver
============================================================================= */

var resolver = new nmcns.Resolver({
    debug: debug,
    defaults: {
        soa: {
            primary: 'ns-a.dnschain.info.',
            admin: 'hostmaster@dnschain.info',
            refresh: 600,
            retry: 600,
            expiration: 600,
            minimum: 300
        }
    }
});

/* DNS Server
============================================================================= */

var server = dns.createServer();

server.on('request', function(req, res) {
    resolver.request(req.question[0], function(err, ans) {
        if (err) { console.log(err.stack); }
        //console.log(ans);

        res.header.rcode = ans.header.rcode;
        res.answer = ans.answer;
        res.authority = ans.authority;
        res.additional = ans.additional;

        try {
            res.send();
        } catch (exc) {
            console.log(exc.stack);
        }
    });
});

server.on('error', function (err, buff, req, res) {
    console.log(err.stack);
});

/* Starting DNS Server
============================================================================= */

var port = 5335;

console.log('Staring DNS server at ' + port + '...');
server.serve(port, '0.0.0.0', function() {
    console.log('  Serving gTLDs: .bit, .steem, .plex, .test');
    console.log('Sample commands (bit):');
    console.log('  nslookup -query=A -port='+port+' sloto.bit localhost');
    console.log('  nslookup -query=SOA -port='+port+' sloto.bit localhost');
    console.log('Sample commands (steem):');
    console.log('  nslookup -query=AAAA -port='+port+' plexrayinc.steem localhost');
    console.log('  nslookup -query=NS -port='+port+' plexrayinc.steem localhost');
    console.log('  nslookup -query=MX -port='+port+' plexrayinc.steem localhost');
    console.log('Sample commands (test):');
    console.log('  nslookup -query=TXT -port='+port+' eu.example.test localhost');
    console.log('  nslookup -query=SRV -port='+port+' _domain._udp.us.example.test localhost');
    console.log('Sample commands (plex):');
    console.log('  nslookup -query=AAAA -port='+port+' atlas.plex localhost');
});
