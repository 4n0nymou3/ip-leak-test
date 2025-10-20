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
        const dnsResolver = request.headers.get('CF-Resolver-IP') || 'Unknown';
        
        const dnsData = {
            clientIP: clientIP,
            dnsResolver: dnsResolver,
            timestamp: new Date().toISOString(),
            cloudflareRay: request.headers.get('CF-Ray') || 'Unknown',
            country: request.cf?.country || 'Unknown',
            city: request.cf?.city || 'Unknown',
            asn: request.cf?.asn || 'Unknown',
            asnOrg: request.cf?.asOrganization || 'Unknown',
            colo: request.cf?.colo || 'Unknown',
            leakDetected: false,
            leakReason: null
        };

        if (dnsResolver !== 'Unknown' && clientIP !== 'Unknown') {
            const resolverParts = dnsResolver.split('.');
            const clientParts = clientIP.split('.');
            
            if (resolverParts[0] !== clientParts[0] || resolverParts[1] !== clientParts[1]) {
                dnsData.leakDetected = true;
                dnsData.leakReason = 'DNS Resolver IP differs significantly from Client IP';
            }
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
        const userAgent = request.headers.get('User-Agent') || '';
        
        const proxyIndicators = [];
        let isProxyLikely = false;
        let isTor = false;
        let isVPN = false;
        let isDatacenter = false;

        const vpnKeywords = ['vpn', 'virtual private', 'proxy', 'anonymizer', 'nordvpn', 'expressvpn', 'mullvad', 'protonvpn', 'surfshark', 'cyberghost', 'private internet access', 'pia'];
        const datacenterKeywords = ['amazon', 'aws', 'google cloud', 'microsoft azure', 'digitalocean', 'ovh', 'hetzner', 'linode', 'vultr', 'cloudflare'];
        const torKeywords = ['tor', 'onion'];

        const asnLower = asOrg.toLowerCase();
        
        for (const keyword of torKeywords) {
            if (asnLower.includes(keyword)) {
                isTor = true;
                proxyIndicators.push(`TOR exit node detected: ${asOrg}`);
                break;
            }
        }

        for (const keyword of vpnKeywords) {
            if (asnLower.includes(keyword)) {
                isVPN = true;
                proxyIndicators.push(`VPN service detected: ${asOrg}`);
                break;
            }
        }

        for (const keyword of datacenterKeywords) {
            if (asnLower.includes(keyword)) {
                isDatacenter = true;
                proxyIndicators.push(`Datacenter IP detected: ${asOrg}`);
                break;
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
            risk: isProxyLikely ? (isTor ? 'High' : (isVPN || isDatacenter ? 'Medium' : 'Low')) : 'Low',
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
