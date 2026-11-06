/**
 * Utility to identify user device, operating system, and camera recommendations
 * Supports iPhone, iPad, Android Phone, Android Tablet, Windows Laptop/PC, MacBook, iMac
 */

export interface DeviceInfo {
  type: 'mobile_phone' | 'tablet' | 'laptop_desktop';
  platformName: string;
  osName: string;
  browserName: string;
  recommendedFacingMode: 'environment' | 'user';
  hasTouch: boolean;
}

export function detectUserDevice(): DeviceInfo {
  if (typeof window === 'undefined') {
    return {
      type: 'laptop_desktop',
      platformName: 'Desktop PC / Laptop',
      osName: 'Unknown',
      browserName: 'Browser',
      recommendedFacingMode: 'user',
      hasTouch: false,
    };
  }

  const ua = navigator.userAgent || '';
  const maxTouchPoints = navigator.maxTouchPoints || 0;
  const hasTouch = maxTouchPoints > 0;

  // iOS detection (including iPadOS on modern Safari where UA contains MacIntel)
  const isIPad =
    /iPad/i.test(ua) || (navigator.platform === 'MacIntel' && maxTouchPoints > 1);
  const isIPhone = /iPhone|iPod/i.test(ua);
  const isIOS = isIPad || isIPhone;

  // Android detection
  const isAndroid = /Android/i.test(ua);
  const isAndroidTablet = isAndroid && !/Mobile/i.test(ua);
  const isAndroidPhone = isAndroid && /Mobile/i.test(ua);

  // macOS / Windows / Linux
  const isMac = /Macintosh|Mac OS X/i.test(ua) && !isIPad;
  const isWindows = /Windows NT|Win64|Win32/i.test(ua);
  const isLinux = /Linux/i.test(ua) && !isAndroid;

  // Browser detection
  let browserName = 'Chrome / Edge';
  if (/CriOS|FxiOS|Safari/i.test(ua) && !/Chrome|Edg/i.test(ua)) {
    browserName = 'Safari';
  } else if (/Edg/i.test(ua)) {
    browserName = 'Microsoft Edge';
  } else if (/Chrome/i.test(ua)) {
    browserName = 'Google Chrome';
  } else if (/Firefox/i.test(ua)) {
    browserName = 'Mozilla Firefox';
  }

  let type: 'mobile_phone' | 'tablet' | 'laptop_desktop' = 'laptop_desktop';
  let platformName = 'Windows / Mac PC';
  let osName = 'Desktop OS';
  let recommendedFacingMode: 'environment' | 'user' = 'user';

  if (isIPhone) {
    type = 'mobile_phone';
    platformName = 'Apple iPhone';
    osName = 'iOS';
    recommendedFacingMode = 'environment';
  } else if (isIPad) {
    type = 'tablet';
    platformName = 'Apple iPad';
    osName = 'iPadOS';
    recommendedFacingMode = 'environment';
  } else if (isAndroidPhone) {
    type = 'mobile_phone';
    platformName = 'Android Smartphone';
    osName = 'Android';
    recommendedFacingMode = 'environment';
  } else if (isAndroidTablet) {
    type = 'tablet';
    platformName = 'Android Tablet';
    osName = 'Android';
    recommendedFacingMode = 'environment';
  } else if (isMac) {
    type = 'laptop_desktop';
    platformName = 'MacBook / iMac (macOS)';
    osName = 'macOS';
    recommendedFacingMode = 'user';
  } else if (isWindows) {
    type = 'laptop_desktop';
    platformName = 'Windows Laptop / Desktop PC';
    osName = 'Windows';
    recommendedFacingMode = 'user';
  } else if (isLinux) {
    type = 'laptop_desktop';
    platformName = 'Linux Desktop / PC';
    osName = 'Linux';
    recommendedFacingMode = 'user';
  }

  return {
    type,
    platformName,
    osName,
    browserName,
    recommendedFacingMode,
    hasTouch,
  };
}
