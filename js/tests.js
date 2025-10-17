const Tests = {
    detectedIPs: new Map(),
    dnsServers: new Map(),
    webrtcConnection: null,
    
    async performWebRTCTest() {
        this.detectedIPs.clear();
        
        if (this.webrtcConnection) {
            this.webrtcConnection.close();
        }
        
        return new Promise((resolve) => {
            this.webrtcConnection = new RTCPeerConnection({
                iceServers: CONFIG.webrtc.stunServers
            });
            
            this.webrtcConnection.createDataChannel('');
            
            let iceGatheringComplete = false;
            
            this.webrtcConnection.onicecandidate = (event) => {
                if (!event || !event.candidate) {
                    if (event && event.candidate === null) {
                        iceGatheringComplete = true;
                    }
                    return;
                }
                
                const candidate = event.candidate.candidate;
                this.parseICECandidate(candidate);
            };
            
            this.webrtcConnection.onicegatheringstatechange = () => {
                if (this.webrtcConnection.iceGatheringState === 'complete') {
                    iceGatheringComplete = true;
                }
            };
            
            this.webrtcConnection.createOffer()
                .then(offer => this.webrtcConnection.setLocalDescription(offer))
                .catch(err => console.error('WebRTC offer error:', err));
            
            setTimeout(() => {
                if (this.webrtcConnection) {
                    this.webrtcConnection.close();
                    this.webrtcConnection = null;
                }
                const ipsArray = Array.from(this.detectedIPs.entries()).map(([ip, data]) => ({
                    ip: ip,
                    type: data.type,
                    candidate: data.candidate
                }));
                resolve(ipsArray);
            }, 5000);
        });
    },
    
    parseICECandidate(candidate) {
        const ipv4Regex = /([0-9]{1,3}\.){3}[0-9]{1,3}/;
        const ipv6Regex = /(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))/;
        
        let ip = null;
        let type = 'Unknown';
        
        if (ipv4Regex.test(candidate)) {
            ip = candidate.match(ipv4Regex)[0];
            type = this.classifyIPv4(ip);
        } else if (ipv6Regex.test(candidate)) {
            ip = candidate.match(ipv6Regex)[0];
            type = this.classifyIPv6(ip);
        }
        
        if (ip && !this.detectedIPs.has(ip)) {
            this.detectedIPs.set(ip, {
                type: type,
                candidate: candidate,
                timestamp: Date.now()
            });
            
            if (typeof window.onWebRTCIP === 'function') {
                window.onWebRTCIP({
                    ip: ip,
                    type: type,
                    candidate: candidate
                });
            }
        }
    },
    
    classifyIPv4(ip) {
        const parts = ip.split('.').map(Number);
        
        if (parts[0] === 10) {
            return 'Private IPv4 (Class A)';
        } else if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
            return 'Private IPv4 (Class B)';
        } else if (parts[0] === 192 && parts[1] === 168) {
            return 'Private IPv4 (Class C)';
        } else if (parts[0] === 127) {
            return 'Loopback IPv4';
        } else if (parts[0] === 169 && parts[1] === 254) {
            return 'Link-Local IPv4';
        } else {
            return 'Public IPv4';
        }
    },
    
    classifyIPv6(ip) {
        const lower = ip.toLowerCase();
        
        if (lower.startsWith('fe80')) {
            return 'Link-Local IPv6';
        } else if (lower.startsWith('fc') || lower.startsWith('fd')) {
            return 'Private IPv6 (ULA)';
        } else if (lower.startsWith('::1') || lower === '::1') {
            return 'Loopback IPv6';
        } else if (lower.startsWith('::')) {
            return 'IPv6 (Compressed)';
        } else {
            return 'Public IPv6';
        }
    },
    
    async performDNSTest() {
        this.dnsServers.clear();
        const results = [];
        const promises = [];
        
        for (const domain of CONFIG.dns.testDomains) {
            const promise = this.testDNSDomain(domain);
            promises.push(promise);
        }
        
        const dnsResults = await Promise.allSettled(promises);
        
        dnsResults.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                results.push(result.value);
                this.dnsServers.set(CONFIG.dns.testDomains[index], result.value);
            } else {
                const errorResult = {
                    domain: CONFIG.dns.testDomains[index],
                    resolved: false,
                    error: result.reason.message,
                    timestamp: new Date().toISOString()
                };
                results.push(errorResult);
                this.dnsServers.set(CONFIG.dns.testDomains[index], errorResult);
            }
        });
        
        return results;
    },
    
    async testDNSDomain(domain) {
        const startTime = Date.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        try {
            const response = await fetch(`https://${domain}`, {
                method: 'HEAD',
                cache: 'no-store',
                mode: 'no-cors',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            const responseTime = Date.now() - startTime;
            
            return {
                domain: domain,
                resolved: true,
                responseTime: responseTime,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    },
    
    compareIPs(cloudflareIP, otherIP) {
        if (!cloudflareIP || !otherIP) {
            return {
                match: false,
                status: 'unknown',
                message: 'Incomplete data'
            };
        }
        
        if (cloudflareIP === otherIP) {
            return {
                match: true,
                status: 'safe',
                message: 'Your IP address is identical from both sources. No leak detected.'
            };
        } else {
            return {
                match: false,
                status: 'warning',
                message: 'Your IP address differs between sources! Possible IP leak detected.'
            };
        }
    },
    
    analyzeWebRTCResults(ips, publicIP) {
        if (!ips || ips.length === 0) {
            return {
                status: 'safe',
                message: 'WebRTC did not expose any additional IP addresses.',
                hasLeak: false
            };
        }
        
        const publicIPs = ips.filter(ipObj => {
            const ip = ipObj.ip;
            return !ip.startsWith('192.168.') && 
                   !ip.startsWith('10.') && 
                   !ip.startsWith('172.') && 
                   !ip.startsWith('127.') &&
                   !ip.startsWith('169.254.') &&
                   !ip.toLowerCase().startsWith('fe80') && 
                   !ip.toLowerCase().startsWith('fc') && 
                   !ip.toLowerCase().startsWith('fd') &&
                   !ip.toLowerCase().startsWith('::1');
        });
        
        if (publicIPs.length > 1) {
            return {
                status: 'leak',
                message: 'Critical! Multiple public IPs detected via WebRTC.',
                hasLeak: true
            };
        }
        
        if (publicIPs.length === 1 && publicIP && publicIPs[0].ip !== publicIP) {
            return {
                status: 'leak',
                message: 'Warning! WebRTC has exposed your real IP address.',
                hasLeak: true
            };
        }
        
        return {
            status: 'safe',
            message: 'WebRTC only shows private/local IPs. No leak detected.',
            hasLeak: false
        };
    },
    
    analyzeDNSResults(dnsResults) {
        const resolvedCount = dnsResults.filter(r => r.resolved).length;
        const totalCount = dnsResults.length;
        
        if (resolvedCount === 0) {
            return {
                status: 'error',
                message: 'DNS test error. No domains are accessible.'
            };
        }
        
        if (resolvedCount === totalCount) {
            return {
                status: 'safe',
                message: `All ${totalCount} DNS servers responded successfully.`
            };
        }
        
        return {
            status: 'warning',
            message: `${resolvedCount} of ${totalCount} DNS servers are accessible.`
        };
    }
};