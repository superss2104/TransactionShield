/**
 * TransactionShield - Global Configuration
 * 
 * IMPORTANT: This file must be loaded BEFORE all other JS files.
 * It provides a single source of truth for shared configuration.
 * 
 * This prevents "Identifier 'API_BASE_URL' has already been declared" errors
 * that occur when multiple JS files declare the same const in global scope.
 */

const API_BASE_URL = 'http://localhost:8000';
