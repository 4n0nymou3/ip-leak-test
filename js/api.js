const API = {
    async fetchCloudflareData() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);
            
            const response = await fetch(CONFIG.cloudflare.apiUrl, {
                method: 'GET',
                cache: 'no-store',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error('Cloudflare API error');
            }
            
            const text = await response.text();
            const data = {};
            
            text.split('\n').forEach(line => {
                const parts = line.split('=');
                if (parts.length === 2) {
                    data[parts[0].trim()] = parts[1].trim();
                }
            });
            
            const ip = data.ip || 'N/A';
            const details = await this.fetchIPInfo(ip);
            
            if (details) {
                return {
                    ip: details.ip || ip,
                    country: details.country_name || 'N/A',
                    countryCode: details.country_code || data.loc || null,
                    city: details.city || data.colo || 'N/A',
                    isp: details.org || 'N/A',
                    timezone: details.timezone || 'N/A',
                    postal: details.postal || 'N/A',
                    region: details.region || 'N/A',
                    coords: details.latitude && details.longitude ? `${details.latitude}, ${details.longitude}` : 'N/A',
                    asn: details.asn || 'N/A'
                };
            } else {
                return {
                    ip: ip,
                    country: data.loc || 'N/A',
                    countryCode: data.loc || null,
                    city: data.colo || 'N/A',
                    isp: 'N/A',
                    timezone: 'N/A',
                    postal: 'N/A',
                    region: 'N/A',
                    coords: 'N/A',
                    asn: 'N/A'
                };
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error('Cloudflare fetch timeout');
            } else {
                console.error('Cloudflare fetch error:', error);
            }
            return null;
        }
    },

    async fetchIpifyData() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);
            
            const ipResponse = await fetch(CONFIG.ipify.apiUrl, {
                cache: 'no-store',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!ipResponse.ok) {
                throw new Error('IPify API error');
            }
            
            const ipData = await ipResponse.json();
            const ip = ipData.ip;
            
            const detailsController = new AbortController();
            const detailsTimeoutId = setTimeout(() => detailsController.abort(), CONFIG.timeout);
            
            const detailsResponse = await fetch(`${CONFIG.ipify.detailsUrl}${ip}/json/`, {
                cache: 'no-store',
                signal: detailsController.signal
            });
            
            clearTimeout(detailsTimeoutId);
            
            if (!detailsResponse.ok) {
                throw new Error('IP details API error');
            }
            
            const details = await detailsResponse.json();
            
            return {
                ip: details.ip || 'N/A',
                country: details.country_name || 'N/A',
                countryCode: details.country_code || null,
                city: details.city || 'N/A',
                isp: details.org || 'N/A',
                region: details.region || 'N/A',
                coords: details.latitude && details.longitude 
                    ? `${details.latitude}, ${details.longitude}` 
                    : 'N/A',
                asn: details.asn || 'N/A',
                timezone: details.timezone || 'N/A',
                postal: details.postal || 'N/A'
            };
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error('IPify fetch timeout');
            } else {
                console.error('IPify fetch error:', error);
            }
            return null;
        }
    },

    async fetchIPv6Data() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);
            
            const ipResponse = await fetch('https://api64.ipify.org?format=json', {
                cache: 'no-store',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!ipResponse.ok) {
                return null;
            }
            
            const ipData = await ipResponse.json();
            const ip = ipData.ip;
            
            if (ip.includes(':')) {
                const details = await this.fetchIPInfo(ip);
                if (details) {
                    return {
                        ip: details.ip || ip,
                        country: details.country_name || 'N/A',
                        countryCode: details.country_code || null,
                        city: details.city || 'N/A',
                        isp: details.org || 'N/A',
                        region: details.region || 'N/A',
                        coords: details.latitude && details.longitude 
                            ? `${details.latitude}, ${details.longitude}` 
                            : 'N/A',
                        asn: details.asn || 'N/A',
                        timezone: details.timezone || 'N/A',
                        postal: details.postal || 'N/A'
                    };
                }
            }
            return null;
        } catch (error) {
            console.error('IPv6 fetch error:', error);
            return null;
        }
    },

    async fetchIPInfo(ip) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);
            
            const response = await fetch(`https://ipapi.co/${ip}/json/`, {
                cache: 'no-store',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error('IP info API error');
            }
            
            return await response.json();
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error('IP info fetch timeout');
            } else {
                console.error('IP info fetch error:', error);
            }
            return null;
        }
    },

    async fetchWithRetry(fetchFunction, maxRetries = 2) {
        for (let i = 0; i < maxRetries; i++) {
            const result = await fetchFunction();
            if (result !== null) {
                return result;
            }
            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        return null;
    },

    async fetchWorkerDNSLeak() {
        if (!CONFIG.worker.enabled) {
            return null;
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);
            
            const response = await fetch(`${CONFIG.worker.apiUrl}/api/dns-leak`, {
                method: 'GET',
                cache: 'no-store',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error('Worker DNS Leak API error');
            }
            
            return await response.json();
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error('Worker DNS Leak fetch timeout');
            } else {
                console.error('Worker DNS Leak fetch error:', error);
            }
            return null;
        }
    },

    async fetchWorkerAdvancedIP() {
        if (!CONFIG.worker.enabled) {
            return null;
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);
            
            const response = await fetch(`${CONFIG.worker.apiUrl}/api/advanced-ip`, {
                method: 'GET',
                cache: 'no-store',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error('Worker Advanced IP API error');
            }
            
            return await response.json();
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error('Worker Advanced IP fetch timeout');
            } else {
                console.error('Worker Advanced IP fetch error:', error);
            }
            return null;
        }
    },

    async fetchWorkerProxyDetection() {
        if (!CONFIG.worker.enabled) {
            return null;
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);
            
            const response = await fetch(`${CONFIG.worker.apiUrl}/api/proxy-detection`, {
                method: 'GET',
                cache: 'no-store',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error('Worker Proxy Detection API error');
            }
            
            return await response.json();
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error('Worker Proxy Detection fetch timeout');
            } else {
                console.error('Worker Proxy Detection fetch error:', error);
            }
            return null;
        }
    }
};