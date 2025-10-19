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
            ctx.fillText('Canvas Fingerprint Test ðŸ”’', 2, 15);
            ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
            ctx.fillText('Canvas Fingerprint Test ðŸ”’', 4, 17);
            
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
    
    async simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    },
    
    async performTimezoneTest() {
        const results = {};
        
        const date = new Date();
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const offset = -date.getTimezoneOffset() / 60;
        
        results.timezone = timezone;
        results.offset = `UTC${offset >= 0 ? '+' : ''}${offset}`;
        results.timestamp = date.toISOString();
        
        const browserTime = date.toLocaleString();
        results.browserTime = browserTime;
        
        const timezoneMatch = timezone.includes('America') || timezone.includes('Europe') || timezone.includes('Asia') || timezone.includes('Africa') || timezone.includes('Australia');
        results.leakDetected = !timezoneMatch;
        
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
