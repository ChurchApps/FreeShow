# Content Providers Architecture

This directory contains a refactored architecture for content providers that makes it easy to add new integrations.

## Architecture Overview

The content provider system follows these design patterns:

### 1. Base Classes
- **`ContentProvider`**: Abstract base class that all providers inherit from
- **`OAuth2Helper`**: Common OAuth2 authentication flows
- **`ContentProviderFactory`**: Factory pattern for managing provider instances

### 2. Common Interface
All content providers implement these core methods:
- `connect(scope)`: Establish connection and authenticate
- `disconnect(scope?)`: Disconnect from the provider
- `apiRequest(data)`: Make authenticated API requests
- `loadServices(dataPath?)`: Load services/plans from the provider
- `startupLoad(scope, data?)`: Handle startup initialization
- `exportData(data)`: Export data to the provider (optional)

### 3. Provider Registry
The `ContentProviderRegistry` manages all provider instances and provides:
- Unified API for all content provider operations
- Dynamic provider registration
- Legacy function compatibility
- Error handling and logging

## Current Providers

### Chums (`ChumsProvider`)
- **Scopes**: `"plans"`
- **Features**: Import service plans, export songs, OAuth2 authentication
- **API**: ChurchApps.org API

### Planning Center (`PlanningCenterProvider`)
- **Scopes**: `"calendar" | "check_ins" | "giving" | "groups" | "people" | "publishing" | "services"`
- **Features**: Import service plans, download media, PKCE OAuth2
- **API**: Planning Center Online API

## Adding a New Provider

1. **Create Provider Class**
```typescript
export class MyProvider extends ContentProvider<MyScopes, MyAuthData> {
  constructor() {
    super({
      name: "myProvider",
      port: 5504,
      clientId: getKey("myprovider_id"),
      clientSecret: getKey("myprovider_secret"),
      apiUrl: "https://api.myprovider.com",
      scopes: ["scope1", "scope2"] as const
    })
  }

  // Implement required methods...
}
```

2. **Register Provider**
```typescript
// In ContentProviderRegistry.ts
ContentProviderFactory.register("myProvider", MyProvider)
```

3. **Add Legacy Functions (optional)**
```typescript
export function myProviderConnect(scope) {
  return ContentProviderRegistry.connect("myProvider", scope)
}
```

4. **Update IPC Handlers**
```typescript
// In responsesMain.ts
import { myProviderConnect } from "../contentProviders"
```

## Benefits

1. **Consistency**: All providers follow the same patterns
2. **Extensibility**: Easy to add new providers
3. **Maintainability**: Shared code for common operations
4. **Testing**: Easier to mock and test individual components
5. **Error Handling**: Centralized error types and handling

## Migration Status

This is a new architecture designed to replace the existing individual provider implementations. The current status:

- ✅ Base architecture designed
- ✅ Chums provider refactored
- ✅ Planning Center provider refactored
- ⚠️ Integration with existing IPC system (in progress)
- ⚠️ Backward compatibility testing (pending)
- ⚠️ Full migration of existing functionality (pending)

## Usage Examples

```typescript
// Connect to a provider
await ContentProviderRegistry.connect("chums", "plans")

// Load services
await ContentProviderRegistry.loadServices("planningCenter", "/path/to/data")

// Check supported scopes
const scopes = ContentProviderRegistry.getSupportedScopes("chums")

// Export data
await ContentProviderRegistry.exportData("chums", songData)
```

## File Structure

```
contentProviders/
├── base/
│   ├── ContentProvider.ts      # Base class
│   ├── OAuth2Helper.ts         # OAuth2 utilities
│   └── types.ts               # Common types
├── chums/
│   ├── ChumsProvider.ts       # Chums implementation
│   ├── types.ts               # Chums-specific types
│   └── ...                    # Legacy files
├── planningCenter/
│   ├── PlanningCenterProvider.ts  # PCO implementation
│   └── ...                        # Legacy files
├── ContentProviderRegistry.ts     # Registry and legacy functions
├── index.ts                      # Public exports
└── README.md                     # This file
```