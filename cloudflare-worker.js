addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
        return new Response(null, {
            headers: corsHeaders
        });
    }

    if (path === '/api/dns-leak') {
        return handleDNSLeak(request, corsHeaders);
    } else if (path === '/api/advanced-ip') {
        return handleAdvancedIP(request, corsHeaders);
    } else if (path === '/api/proxy-detection') {
        return handleProxyDetection(request, corsHeaders);
    } else if (path === '/') {
        return new Response(JSON.stringify({
            status: 'ok',
            message: 'IP Leak Detection API',
            version: '1.0.0',
            endpoints: [
                '/api/dns-leak',
                '/api/advanced-ip',
                '/api/proxy-detection'
            ]
        }), {
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
        });
    }

    return new Response('Not Found', {
        status: 404,
        headers: corsHeaders
    });
}

async function handleDNSLeak(request, corsHeaders) {
    try {
        const clientIP = request.headers.get('CF-Connecting-IP') || 'Unknown';
        const asOrganization = request.cf?.asOrganization || 'Unknown';
        const clientASN = request.cf?.asn || 'Unknown';

        const dnsData = {
            clientIP: clientIP,
            asOrganization: asOrganization,
            asn: clientASN,
            timestamp: new Date().toISOString(),
            cloudflareRay: request.headers.get('CF-Ray') || 'Unknown',
            country: request.cf?.country || 'Unknown',
            city: request.cf?.city || 'Unknown',
            colo: request.cf?.colo || 'Unknown',
            leakDetected: false,
            leakReason: null
        };
        
        const isp = asOrganization.toLowerCase();
        const commonDnsProviders = ['google', 'cloudflare', 'quad9', 'opendns'];
        const isCommonPublicDNS = commonDnsProviders.some(provider => isp.includes(provider));
        
        if (clientASN && clientASN !== request.cf?.asn) {
             dnsData.leakDetected = true;
             dnsData.leakReason = 'Client ASN differs from expected ASN, potential DNS leak.';
        } else if (isCommonPublicDNS) {
            dnsData.leakDetected = false;
            dnsData.leakReason = 'Using a known public DNS provider.';
        }


        return new Response(JSON.stringify(dnsData), {
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'DNS Leak detection failed',
            message: error.message
        }), {
            status: 500,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
        });
    }
}

async function handleAdvancedIP(request, corsHeaders) {
    try {
        const clientIP = request.headers.get('CF-Connecting-IP') || 'Unknown';
        
        const ipData = {
            ip: clientIP,
            country: request.cf?.country || 'Unknown',
            countryName: getCountryName(request.cf?.country),
            region: request.cf?.region || 'Unknown',
            city: request.cf?.city || 'Unknown',
            postalCode: request.cf?.postalCode || 'Unknown',
            timezone: request.cf?.timezone || 'Unknown',
            latitude: request.cf?.latitude || 'Unknown',
            longitude: request.cf?.longitude || 'Unknown',
            asn: request.cf?.asn || 'Unknown',
            asnOrg: request.cf?.asOrganization || 'Unknown',
            colo: request.cf?.colo || 'Unknown',
            metroCode: request.cf?.metroCode || 'Unknown',
            continent: request.cf?.continent || 'Unknown',
            isEU: request.cf?.isEUCountry ? 'Yes' : 'No',
            timestamp: new Date().toISOString(),
            headers: {
                userAgent: request.headers.get('User-Agent') || 'Unknown',
                acceptLanguage: request.headers.get('Accept-Language') || 'Unknown',
                acceptEncoding: request.headers.get('Accept-Encoding') || 'Unknown',
                referer: request.headers.get('Referer') || 'None',
                origin: request.headers.get('Origin') || 'None'
            }
        };

        const ipv4Parts = clientIP.split('.');
        if (ipv4Parts.length === 4) {
            const firstOctet = parseInt(ipv4Parts[0]);
            const secondOctet = parseInt(ipv4Parts[1]);
            
            if (firstOctet === 10) {
                ipData.ipType = 'Private (10.0.0.0/8)';
            } else if (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31) {
                ipData.ipType = 'Private (172.16.0.0/12)';
            } else if (firstOctet === 192 && secondOctet === 168) {
                ipData.ipType = 'Private (192.168.0.0/16)';
            } else if (firstOctet === 127) {
                ipData.ipType = 'Loopback';
            } else {
                ipData.ipType = 'Public';
            }
        } else if (clientIP.includes(':')) {
            ipData.ipType = 'IPv6';
        } else {
            ipData.ipType = 'Unknown';
        }

        return new Response(JSON.stringify(ipData), {
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Advanced IP detection failed',
            message: error.message
        }), {
            status: 500,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
        });
    }
}

async function handleProxyDetection(request, corsHeaders) {
    try {
        const clientIP = request.headers.get('CF-Connecting-IP') || 'Unknown';
        const asOrg = request.cf?.asOrganization || '';
        const country = request.cf?.country || 'Unknown';
        
        const proxyIndicators = [];
        let isProxyLikely = false;
        let isTor = false;
        let isVPN = false;
        let isDatacenter = false;

        const vpnKeywords = ['vpn', 'virtual private', 'proxy', 'anonymizer', 'nordvpn', 'expressvpn', 'mullvad', 'protonvpn', 'surfshark', 'cyberghost', 'private internet access', 'pia', 'windscribe', 'vyprvpn', 'tunnelbear', 'hidemyass', 'ipvanish', 'zenmate', 'strongvpn'];
        const datacenterKeywords = ['amazon', 'aws', 'google cloud', 'microsoft azure', 'digitalocean', 'ovh', 'hetzner', 'linode', 'vultr', 'cloudflare', 'm247', 'leaseweb', 'choopa', 'datacamp', 'frantech', 'online.net', 'scaleway', 'contabo', 'interserver', 'fastly', 'stackpath'];
        const residentialKeywords = ['isp', 'broadband', 'telecom', 'mobile', 'cable', 'communications', 'internet services', 'telecommunication'];

        if (country === 'T1') {
            isTor = true;
            proxyIndicators.push('Tor exit node detected (via country code T1)');
        } else {
            const asnLower = asOrg.toLowerCase();
            let isResidential = false;
            for (const keyword of residentialKeywords) {
                if (asnLower.includes(keyword)) {
                    isResidential = true;
                    break;
                }
            }

            if (!isResidential) {
                for (const keyword of vpnKeywords) {
                    if (asnLower.includes(keyword)) {
                        isVPN = true;
                        proxyIndicators.push(`VPN service detected: ${asOrg}`);
                        break;
                    }
                }
                if (!isVPN) {
                    for (const keyword of datacenterKeywords) {
                        if (asnLower.includes(keyword)) {
                            isDatacenter = true;
                            isVPN = true;
                            proxyIndicators.push(`Datacenter/VPN IP detected: ${asOrg}`);
                            break;
                        }
                    }
                }
            }
        }

        const forwardedFor = request.headers.get('X-Forwarded-For');
        const realIP = request.headers.get('X-Real-IP');
        const viaHeader = request.headers.get('Via');
        
        if (forwardedFor) {
            proxyIndicators.push('X-Forwarded-For header present');
            isProxyLikely = true;
        }
        
        if (realIP) {
            proxyIndicators.push('X-Real-IP header present');
            isProxyLikely = true;
        }
        
        if (viaHeader) {
            proxyIndicators.push(`Via header present: ${viaHeader}`);
            isProxyLikely = true;
        }

        if (isTor || isVPN || isDatacenter) {
            isProxyLikely = true;
        }

        const detectionData = {
            ip: clientIP,
            isProxyLikely: isProxyLikely,
            isTor: isTor,
            isVPN: isVPN,
            isDatacenter: isDatacenter,
            proxyIndicators: proxyIndicators,
            asn: request.cf?.asn || 'Unknown',
            asnOrg: asOrg,
            country: request.cf?.country || 'Unknown',
            risk: isProxyLikely ? (isTor ? 'High' : (isVPN || isDatacenter ? 'Medium' : 'Low')) : 'Very Low',
            timestamp: new Date().toISOString()
        };

        return new Response(JSON.stringify(detectionData), {
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Proxy detection failed',
            message: error.message
        }), {
            status: 500,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
        });
    }
}

function getCountryName(code) {
    if (code === 'T1') return 'Tor Network';
    const countries = {
        'US': 'United States', 'GB': 'United Kingdom', 'CA': 'Canada', 'AU': 'Australia',
        'DE': 'Germany', 'FR': 'France', 'IT': 'Italy', 'ES': 'Spain', 'NL': 'Netherlands',
        'SE': 'Sweden', 'NO': 'Norway', 'DK': 'Denmark', 'FI': 'Finland', 'PL': 'Poland',
        'RU': 'Russia', 'CN': 'China', 'JP': 'Japan', 'KR': 'South Korea', 'IN': 'India',
        'BR': 'Brazil', 'MX': 'Mexico', 'AR': 'Argentina', 'CL': 'Chile', 'CO': 'Colombia',
        'ZA': 'South Africa', 'EG': 'Egypt', 'NG': 'Nigeria', 'KE': 'Kenya',
        'SG': 'Singapore', 'MY': 'Malaysia', 'TH': 'Thailand', 'ID': 'Indonesia', 'PH': 'Philippines',
        'VN': 'Vietnam', 'TR': 'Turkey', 'SA': 'Saudi Arabia', 'AE': 'United Arab Emirates',
        'IR': 'Iran', 'IQ': 'Iraq', 'IL': 'Israel', 'PK': 'Pakistan', 'BD': 'Bangladesh',
        'UA': 'Ukraine', 'RO': 'Romania', 'CZ': 'Czech Republic', 'GR': 'Greece', 'PT': 'Portugal',
        'BE': 'Belgium', 'AT': 'Austria', 'CH': 'Switzerland', 'IE': 'Ireland', 'NZ': 'New Zealand'
    };
    return countries[code] || code;
}