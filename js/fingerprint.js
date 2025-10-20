const FingerprintTests = {
    async performFingerprintTest() {
        const results = {};
        
        results.canvas = await this.getCanvasFingerprint();
        results.webgl = await this.getWebGLFingerprint();
        results.fonts = await this.getFontsFingerprint();
        results.plugins = await this.getPluginsInfo();
        results.screen = this.getScreenInfo();
        results.languages = this.getLanguagesInfo();
        results.platform = this.getPlatformInfo();
        results.hardware = this.getHardwareInfo();
        results.connection = await this.getConnectionInfo();
        results.battery = await this.getBatteryInfo();
        results.doNotTrack = this.getDoNotTrackInfo();
        
        return results;
    },
    
    async getCanvasFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            canvas.width = 200;
            canvas.height = 50;
            
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillStyle = '#f60';
            ctx.fillRect(125, 1, 62, 20);
            ctx.fillStyle = '#069';
            ctx.fillText('Canvas Fingerprint Test ', 2, 15);
            ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
            ctx.fillText('Canvas Fingerprint Test ', 4, 17);
            
            const dataURL = canvas.toDataURL();
            const hash = await this.simpleHash(dataURL);
            
            return {
                detected: true,
                hash: hash.substring(0, 16),
                unique: true
            };
        } catch (error) {
            return {
                detected: false,
                hash: 'Error',
                unique: false
            };
        }
    },
    
    async getWebGLFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            
            if (!gl) {
                return {
                    detected: false,
                    vendor: 'Not Available',
                    renderer: 'Not Available'
                };
            }
            
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            const vendor = debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'Unknown';
            const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'Unknown';
            
            return {
                detected: true,
                vendor: vendor,
                renderer: renderer
            };
        } catch (error) {
            return {
                detected: false,
                vendor: 'Error',
                renderer: 'Error'
            };
        }
    },
    
    async getFontsFingerprint() {
        const baseFonts = ['monospace', 'sans-serif', 'serif'];
        const testFonts = [
            'Arial', 'Verdana', 'Courier New', 'Georgia', 'Times New Roman',
            'Trebuchet MS', 'Comic Sans MS', 'Impact', 'Palatino', 'Garamond',
            'Bookman', 'Avant Garde', 'Helvetica', 'Calibri', 'Cambria'
        ];
        
        const detectedFonts = [];
        
        const testString = 'mmmmmmmmmmlli';
        const testSize = '72px';
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const baseMeasurements = {};
        for (const baseFont of baseFonts) {
            ctx.font = `${testSize} ${baseFont}`;
            baseMeasurements[baseFont] = ctx.measureText(testString).width;
        }
        
        for (const testFont of testFonts) {
            let detected = false;
            for (const baseFont of baseFonts) {
                ctx.font = `${testSize} '${testFont}', ${baseFont}`;
                const width = ctx.measureText(testString).width;
                if (width !== baseMeasurements[baseFont]) {
                    detected = true;
                    break;
                }
            }
            if (detected) {
                detectedFonts.push(testFont);
            }
        }
        
        return {
            detected: detectedFonts.length > 0,
            count: detectedFonts.length,
            fonts: detectedFonts.slice(0, 5).join(', ') + (detectedFonts.length > 5 ? '...' : '')
        };
    },
    
    async getPluginsInfo() {
        const plugins = [];
        
        if (navigator.plugins && navigator.plugins.length > 0) {
            for (let i = 0; i < Math.min(navigator.plugins.length, 5); i++) {
                plugins.push(navigator.plugins[i].name);
            }
        }
        
        return {
            detected: plugins.length > 0,
            count: navigator.plugins ? navigator.plugins.length : 0,
            plugins: plugins.join(', ') || 'None detected'
        };
    },
    
    getScreenInfo() {
        return {
            detected: true,
            resolution: `${screen.width}x${screen.height}`,
            colorDepth: `${screen.colorDepth} bits`,
            pixelRatio: window.devicePixelRatio || 1
        };
    },
    
    getLanguagesInfo() {
        const languages = navigator.languages || [navigator.language || navigator.userLanguage];
        return {
            detected: true,
            primary: navigator.language || navigator.userLanguage,
            all: languages.join(', ')
        };
    },
    
    getPlatformInfo() {
        return {
            detected: true,
            platform: navigator.platform,
            userAgent: navigator.userAgent.substring(0, 50) + '...',
            cookieEnabled: navigator.cookieEnabled,
            doNotTrack: navigator.doNotTrack || 'not set'
        };
    },
    
    getHardwareInfo() {
        return {
            detected: true,
            cores: navigator.hardwareConcurrency || 'Unknown',
            memory: navigator.deviceMemory ? `${navigator.deviceMemory} GB` : 'Unknown',
            touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0
        };
    },
    
    async getConnectionInfo() {
        try {
            const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            
            if (connection) {
                return {
                    detected: true,
                    type: connection.effectiveType || connection.type || 'Unknown',
                    downlink: connection.downlink ? `${connection.downlink} Mbps` : 'Unknown',
                    rtt: connection.rtt ? `${connection.rtt} ms` : 'Unknown',
                    saveData: connection.saveData ? 'Enabled' : 'Disabled'
                };
            }
            
            return {
                detected: false,
                type: 'Not Available',
                downlink: 'Not Available',
                rtt: 'Not Available',
                saveData: 'Not Available'
            };
        } catch (error) {
            return {
                detected: false,
                type: 'Error',
                downlink: 'Error',
                rtt: 'Error',
                saveData: 'Error'
            };
        }
    },
    
    async getBatteryInfo() {
        try {
            if ('getBattery' in navigator) {
                const battery = await navigator.getBattery();
                return {
                    detected: true,
                    level: `${Math.round(battery.level * 100)}%`,
                    charging: battery.charging ? 'Yes' : 'No',
                    chargingTime: battery.chargingTime === Infinity ? 'N/A' : `${Math.round(battery.chargingTime / 60)} min`,
                    dischargingTime: battery.dischargingTime === Infinity ? 'N/A' : `${Math.round(battery.dischargingTime / 60)} min`
                };
            }
            
            return {
                detected: false,
                level: 'Not Available',
                charging: 'Not Available',
                chargingTime: 'Not Available',
                dischargingTime: 'Not Available'
            };
        } catch (error) {
            return {
                detected: false,
                level: 'Blocked/Error',
                charging: 'Blocked/Error',
                chargingTime: 'Blocked/Error',
                dischargingTime: 'Blocked/Error'
            };
        }
    },
    
    getDoNotTrackInfo() {
        const dnt = navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack;
        
        let status = 'Not Set';
        if (dnt === '1' || dnt === 'yes') {
            status = 'Enabled';
        } else if (dnt === '0' || dnt === 'no') {
            status = 'Disabled';
        }
        
        return {
            detected: true,
            status: status,
            value: dnt || 'null'
        };
    },
    
    async simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    },
    
    async performTimezoneTest(ipCountry, ipCity) {
        const results = {};
        
        const date = new Date();
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const offset = -date.getTimezoneOffset() / 60;
        
        results.timezone = timezone;
        results.offset = `UTC${offset >= 0 ? '+' : ''}${offset}`;
        results.timestamp = date.toISOString();
        results.browserTime = date.toLocaleString();
        
        const timezoneToCountry = {
            'Europe/Amsterdam': ['NL', 'Netherlands'],
            'Europe/London': ['GB', 'United Kingdom'],
            'Europe/Paris': ['FR', 'France'],
            'Europe/Berlin': ['DE', 'Germany'],
            'Europe/Rome': ['IT', 'Italy'],
            'Europe/Madrid': ['ES', 'Spain'],
            'Europe/Stockholm': ['SE', 'Sweden'],
            'Europe/Warsaw': ['PL', 'Poland'],
            'Europe/Moscow': ['RU', 'Russia'],
            'America/New_York': ['US', 'United States'],
            'America/Chicago': ['US', 'United States'],
            'America/Denver': ['US', 'United States'],
            'America/Los_Angeles': ['US', 'United States'],
            'America/Toronto': ['CA', 'Canada'],
            'America/Vancouver': ['CA', 'Canada'],
            'America/Mexico_City': ['MX', 'Mexico'],
            'America/Sao_Paulo': ['BR', 'Brazil'],
            'America/Argentina/Buenos_Aires': ['AR', 'Argentina'],
            'Asia/Dubai': ['AE', 'United Arab Emirates'],
            'Asia/Tehran': ['IR', 'Iran'],
            'Asia/Karachi': ['PK', 'Pakistan'],
            'Asia/Kolkata': ['IN', 'India'],
            'Asia/Dhaka': ['BD', 'Bangladesh'],
            'Asia/Bangkok': ['TH', 'Thailand'],
            'Asia/Singapore': ['SG', 'Singapore'],
            'Asia/Hong_Kong': ['HK', 'Hong Kong'],
            'Asia/Shanghai': ['CN', 'China'],
            'Asia/Tokyo': ['JP', 'Japan'],
            'Asia/Seoul': ['KR', 'South Korea'],
            'Australia/Sydney': ['AU', 'Australia'],
            'Australia/Melbourne': ['AU', 'Australia'],
            'Australia/Perth': ['AU', 'Australia'],
            'Pacific/Auckland': ['NZ', 'New Zealand'],
            'Africa/Cairo': ['EG', 'Egypt'],
            'Africa/Johannesburg': ['ZA', 'South Africa'],
            'Africa/Lagos': ['NG', 'Nigeria'],
            'Africa/Nairobi': ['KE', 'Kenya']
        };
        
        results.leakDetected = false;
        results.leakReason = null;
        
        if (ipCountry && timezone) {
            const expectedCountries = timezoneToCountry[timezone];
            
            if (expectedCountries) {
                const countryMatch = expectedCountries.some(country => {
                    return ipCountry.toUpperCase().includes(country.toUpperCase()) || 
                           country.toUpperCase().includes(ipCountry.toUpperCase());
                });
                
                if (!countryMatch) {
                    results.leakDetected = true;
                    results.leakReason = `Timezone mismatch: Your IP shows ${ipCountry} but browser timezone is ${timezone}`;
                }
            } else {
                const timezoneRegion = timezone.split('/')[0];
                const ipRegionMap = {
                    'Europe': ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'GB', 'NO', 'CH', 'IS', 'RS', 'UA', 'BY', 'MD', 'BA', 'AL', 'MK', 'ME', 'XK', 'RU'],
                    'America': ['US', 'CA', 'MX', 'BR', 'AR', 'CL', 'CO', 'PE', 'VE', 'EC', 'BO', 'PY', 'UY', 'GY', 'SR', 'GF', 'CR', 'PA', 'GT', 'HN', 'NI', 'SV', 'BZ', 'JM', 'HT', 'DO', 'CU', 'TT', 'BB', 'PR'],
                    'Asia': ['CN', 'IN', 'ID', 'PK', 'BD', 'JP', 'PH', 'VN', 'TR', 'IR', 'TH', 'MM', 'KR', 'IQ', 'AF', 'SA', 'UZ', 'MY', 'YE', 'NP', 'KP', 'LK', 'KH', 'JO', 'AZ', 'TJ', 'AE', 'IL', 'LA', 'SG', 'LB', 'KG', 'TM', 'SY', 'KW', 'GE', 'OM', 'AM', 'MN', 'QA', 'BH', 'PS', 'BT', 'MV', 'BN', 'TL'],
                    'Africa': ['NG', 'ET', 'EG', 'CD', 'TZ', 'ZA', 'KE', 'UG', 'DZ', 'SD', 'MA', 'AO', 'GH', 'MZ', 'MG', 'CM', 'CI', 'NE', 'BF', 'ML', 'MW', 'ZM', 'SO', 'SN', 'TD', 'ZW', 'GN', 'RW', 'BJ', 'TN', 'BI', 'SS', 'TG', 'SL', 'LY', 'LR', 'CF', 'MR', 'ER', 'GM', 'BW', 'GA', 'NA', 'LS', 'GW', 'GQ', 'MU', 'SZ', 'DJ', 'RE', 'KM', 'CV', 'ST', 'SC', 'YT'],
                    'Australia': ['AU'],
                    'Pacific': ['NZ', 'PG', 'FJ', 'NC', 'PF', 'SB', 'VU', 'GU', 'WS', 'KI', 'FM', 'TO', 'PW', 'MH', 'NR', 'TV', 'AS', 'MP', 'CK', 'NU', 'TK', 'WF', 'PN']
                };
                
                const expectedRegionCountries = ipRegionMap[timezoneRegion];
                if (expectedRegionCountries) {
                    const regionMatch = expectedRegionCountries.includes(ipCountry.toUpperCase());
                    if (!regionMatch) {
                        results.leakDetected = true;
                        results.leakReason = `Region mismatch: Your IP shows ${ipCountry} but browser timezone region is ${timezoneRegion}`;
                    }
                }
            }
        }
        
        return results;
    },
    
    async performPortScanTest() {
        const commonPorts = [80, 443, 8080, 3000, 5000];
        const results = [];
        
        for (const port of commonPorts) {
            try {
                const startTime = Date.now();
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 1000);
                
                await fetch(`http://localhost:${port}`, {
                    method: 'GET',
                    mode: 'no-cors',
                    signal: controller.signal
                }).catch(() => {});
                
                clearTimeout(timeoutId);
                const responseTime = Date.now() - startTime;
                
                results.push({
                    port: port,
                    status: responseTime < 500 ? 'Potentially Open' : 'Closed/Filtered',
                    responseTime: responseTime
                });
            } catch (error) {
                results.push({
                    port: port,
                    status: 'Closed/Filtered',
                    responseTime: null
                });
            }
        }
        
        return results;
    }
};