export interface ParsedUA {
  os: string;
  browser: string;
  deviceType: string;
  formatted: string;
}

/**
 * A lightweight user agent parser that extracts the OS, Browser, and Device Type
 * to identify a device from HTTP headers.
 */
export function parseUserAgent(uaString: string | undefined): ParsedUA {
  if (!uaString) {
    return {
      os: 'Unknown OS',
      browser: 'Unknown Browser',
      deviceType: 'Unknown Device',
      formatted: 'Unknown Device',
    };
  }

  let os = 'Unknown OS';
  let browser = 'Unknown Browser';
  let deviceType = 'Desktop';

  // Detect OS
  if (/windows/i.test(uaString)) {
    os = 'Windows';
  } else if (/macintosh|mac os x/i.test(uaString)) {
    os = 'macOS';
  } else if (/linux/i.test(uaString)) {
    os = 'Linux';
  } else if (/android/i.test(uaString)) {
    os = 'Android';
    deviceType = 'Mobile';
  } else if (/iphone|ipad|ipod/i.test(uaString)) {
    os = 'iOS';
    deviceType = 'Mobile';
  }

  // Detect Browser
  if (/chrome|crios/i.test(uaString) && !/edge|edg/i.test(uaString) && !/opr/i.test(uaString)) {
    browser = 'Chrome';
  } else if (/safari/i.test(uaString) && !/chrome|crios/i.test(uaString)) {
    browser = 'Safari';
  } else if (/firefox|fxios/i.test(uaString)) {
    browser = 'Firefox';
  } else if (/edge|edg/i.test(uaString)) {
    browser = 'Edge';
  } else if (/opr/i.test(uaString)) {
    browser = 'Opera';
  } else if (/postman/i.test(uaString)) {
    browser = 'Postman';
  }

  const formatted = `${browser} on ${os}`;
  return { os, browser, deviceType, formatted };
}
