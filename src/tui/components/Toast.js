// src/tui/components/Toast.js
// Premium Toast Notification System for SparkCell TUI

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text } from 'ink';
import { THEME, ANSI } from '../../cli/colors.js';

// Toast types with their colors and icons
const TOAST_TYPES = {
  success: { color: THEME.success, icon: '✓' },
  error: { color: THEME.error, icon: '✗' },
  warning: { color: THEME.warning, icon: '!' },
  info: { color: THEME.info, icon: 'ℹ' },
};

// Default toast duration (ms)
const DEFAULT_DURATION = 5000;

// Maximum toasts to show at once
const MAX_TOASTS = 3;

/**
 * Single Toast Component
 */
function ToastItem({ toast, onDismiss }) {
  const { type = 'info', message, title, actions } = toast;
  const config = TOAST_TYPES[type] || TOAST_TYPES.info;

  // Auto-dismiss timer
  useEffect(() => {
    if (toast.duration !== 0) {
      const timer = setTimeout(() => {
        onDismiss(toast.id);
      }, toast.duration || DEFAULT_DURATION);
      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration, onDismiss]);

  const titleText = title || type.charAt(0).toUpperCase() + type.slice(1);

  return React.createElement(
    Box,
    { flexDirection: 'column', borderStyle: 'round', borderColor: config.color, paddingX: 1, marginBottom: 1 },
    // Title row
    React.createElement(
      Box,
      null,
      React.createElement(Text, { bold: true, color: config.color }, config.icon + ' ' + titleText),
      toast.dismissable !== false && React.createElement(Text, { dimColor: true }, ' ×')
    ),
    // Message
    message && React.createElement(Text, null, message),
    // Actions
    actions && actions.length > 0 && React.createElement(
      Box,
      { marginTop: 1 },
      ...actions.map((action, i) =>
        React.createElement(Text, { key: i, color: THEME.primary }, '[' + action.label + '] ')
      )
    )
  );
}

/**
 * Toast Container - Manages all toasts
 */
export function ToastContainer({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  // Show only the most recent toasts
  const visibleToasts = toasts.slice(-MAX_TOASTS);

  return React.createElement(
    Box,
    { flexDirection: 'column', position: 'absolute', bottom: 2, right: 2 },
    ...visibleToasts.map(toast =>
      React.createElement(ToastItem, { key: toast.id, toast: toast, onDismiss: onDismiss })
    )
  );
}

/**
 * useToast Hook - Manages toast state
 */
export function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((toast) => {
    const id = toast.id || 'toast-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    const newToast = { ...toast, id };
    setToasts(prev => [...prev, newToast]);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  // Convenience methods
  const success = useCallback((message, options = {}) => {
    return addToast({ type: 'success', message, ...options });
  }, [addToast]);

  const error = useCallback((message, options = {}) => {
    return addToast({ type: 'error', message, ...options });
  }, [addToast]);

  const warning = useCallback((message, options = {}) => {
    return addToast({ type: 'warning', message, ...options });
  }, [addToast]);

  const info = useCallback((message, options = {}) => {
    return addToast({ type: 'info', message, ...options });
  }, [addToast]);

  return {
    toasts,
    addToast,
    removeToast,
    clearToasts,
    success,
    error,
    warning,
    info,
  };
}

/**
 * Error Toast with actionable suggestions
 */
export function errorToast(message, suggestions = []) {
  return {
    type: 'error',
    title: 'Error',
    message: message,
    duration: 8000,
    actions: suggestions.map(s => ({ label: s, action: 'suggestion' })),
  };
}

/**
 * Success Toast
 */
export function successToast(message, details = null) {
  return {
    type: 'success',
    title: 'Success',
    message: details ? message + '\n' + details : message,
    duration: 3000,
  };
}

/**
 * Warning Toast
 */
export function warningToast(message, hint = null) {
  return {
    type: 'warning',
    title: 'Warning',
    message: hint ? message + '\n💡 ' + hint : message,
    duration: 6000,
  };
}

/**
 * Info Toast
 */
export function infoToast(message, title = 'Info') {
  return {
    type: 'info',
    title: title,
    message: message,
    duration: 4000,
  };
}

export default {
  ToastContainer,
  useToast,
  errorToast,
  successToast,
  warningToast,
  infoToast,
};