/* -*- coding: utf-8 -*-
============================================================================= */
/*jshint asi: true*/

var debug = require('debug')('nmcns:server');

var nmcpp = require('nmcpp');
var nmcns = require('nmcns');
var dns = require('native-dns');

var httpRequest = require('request');
var urljoin = require('url-join');

/* Web Provider
============================================================================= */

var WebProvider = nmcpp.Provider.extend({
    init: function(opts) {
        nmcpp.Provider.prototype.init.apply(this, arguments);
        this.addr = opts.addr;
    }, 
    load: function(name, callback) {
        httpRequest({
            method: 'GET',
            url: urljoin(this.addr, name),
            headers: { 'Accept': 'application/json' }
        }, function(error, response, body) {
            if (error || response.statusCode != 200) {
                return callback(new Error(error || response.statusCode));
            }
            return nmcpp.parseNameData(body, callback);
        });
    }
});

/* Web Provider
============================================================================= */

new WebProvider({
    addr: 'https://dnschain.info/bit/'
});

new nmcpp.TestProvider({
    debug: debug,
    gtld: 'coin'
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
server.serve(port, function() {
    console.log('  Serving gTLDs: .bit, .coin');
    console.log('Try the following commands:');
    console.log('  nslookup -query=SOA -port='+port+' webrtc.bit localhost');
    console.log('  nslookup -query=TXT -port='+port+' eu.example.coin localhost');
    console.log('  nslookup -query=SRV -port='+port+' _domain._udp.us.example.coin localhost');
});
