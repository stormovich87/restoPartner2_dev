# Poster Order Integration - Implementation Summary

## Overview
Successfully implemented integration with Poster POS system for automatic order sending when creating orders in the CRM.

## What Was Implemented

### 1. Edge Functions

#### `poster-get-spots`
- **Purpose**: Retrieves list of Poster locations (spots) from Poster API
- **Method**: POST
- **Input**: `poster_account`, `poster_api_token`
- **Output**: List of spots with `spot_id`, `name`, `address`
- **Location**: `/supabase/functions/poster-get-spots/index.ts`

#### `poster-create-order`
- **Purpose**: Sends order to Poster via `incomingOrders.createIncomingOrder` API
- **Method**: POST
- **Input**: `poster_account`, `poster_api_token`, `order_data`
- **Output**: Poster response with `incoming_order_id` and `status`
- **Location**: `/supabase/functions/poster-create-order/index.ts`

### 2. Frontend Components

#### `PosterSpotSelectorModal.tsx`
- Modal for selecting Poster spot (location) to link to a branch
- Displays table of available spots with search functionality
- Shows spot_id, name, and address
- **Location**: `/src/components/PosterSpotSelectorModal.tsx`

#### Updated `EditBranchModal.tsx`
- Added "Интеграция с Poster" section
- Button to select/change Poster spot
- Displays current linked spot information
- Option to unlink spot
- Saves `poster_spot_id`, `poster_spot_name`, `poster_spot_address` to branches table

#### Updated `CreateOrderModal.tsx`
- Added `sendOrderToPoster()` function
- Automatically sends order to Poster after successful creation in CRM
- Handles all error cases without breaking order creation
- Updates order with Poster tracking fields

### 3. Order Flow

When "Создать заказ" button is clicked:

**Step 1: Create Order in CRM**
- Insert order into `orders` table
- If error occurs, stop and show error to user
- Do NOT attempt Poster integration if CRM order creation fails

**Step 2: Send to Poster (if conditions met)**
- Check if Poster settings exist (`poster_account`, `poster_api_token`)
- Check if branch has `poster_spot_id` configured
- Check if phone number is provided
- Check if order items exist with `poster_product_id`
- Prepare order data according to Poster API format
- Send to Poster API
- Update order with results

### 4. Poster Order Data Format

```javascript
{
  spot_id: number,           // From branch.poster_spot_id
  phone: string,             // Customer phone (required)
  service_mode: number,      // 1=в заведении, 2=самовывоз, 3=доставка
  comment: string,           // Formatted comment with order details
  products: [                // Array of products
    {
      product_id: number,    // poster_product_id from order_items
      count: number          // quantity
    }
  ],
  client_address: {          // Only for delivery (service_mode=3)
    address1: string,        // Main address line
    address2: string,        // Floor, apartment, entrance, etc.
    comment: string,         // Customer comment
    lat: number,            // Delivery latitude
    lng: number             // Delivery longitude
  }
}
```

### 5. Error Handling

All errors are handled gracefully:

**Missing Poster Settings**
- Order created in CRM successfully
- `sent_to_poster = false`
- `poster_error = "Настройки Poster не указаны"`
- No alert shown (silent failure)

**Branch Without Spot ID**
- Order created in CRM successfully
- `sent_to_poster = false`
- `poster_error = "У филиала не указан Poster spot_id"`
- Alert: "Заказ создан в CRM, но не отправлен в Poster — у филиала не настроено заведение Poster"

**Missing Phone**
- Order created in CRM successfully
- `sent_to_poster = false`
- `poster_error = "Не указан телефон клиента для Poster"`
- Alert shown

**Empty Products List**
- Order created in CRM successfully
- `sent_to_poster = false`
- `poster_error = "Список товаров для Poster пуст"`
- Alert shown

**Poster API Error**
- Order created in CRM successfully
- `sent_to_poster = false`
- `poster_error = <error message from API>`
- Alert with error details

**Success**
- Order created in CRM successfully
- Order sent to Poster successfully
- `sent_to_poster = true`
- `poster_order_id = <incoming_order_id from Poster>`
- `poster_status = <status from Poster or "created">`
- `poster_error = null`
- Alert: "Заказ успешно отправлен в Poster"

### 6. Database Fields

**branches table** (already existed):
- `poster_spot_id` (bigint) - Poster spot ID
- `poster_spot_name` (text) - Poster spot name
- `poster_spot_address` (text) - Poster spot address

**orders table** (already existed):
- `sent_to_poster` (boolean) - Flag if sent to Poster
- `poster_order_id` (text) - Poster order ID
- `poster_status` (text) - Status from Poster
- `poster_error` (text) - Error message if failed

**partner_settings table** (already existed):
- `poster_account` - Poster account name
- `poster_api_token` - Poster API token

## How to Use

### 1. Configure Poster Settings
Go to **Настройки → Poster** and configure:
- Poster Account
- Poster API Token

### 2. Link Branches to Poster Spots
1. Go to **Филиалы**
2. Click edit on a branch
3. In "Интеграция с Poster" section, click "Выбрать заведение Poster"
4. Select the appropriate Poster spot from the list
5. Save the branch

### 3. Create Orders
When creating an order:
- Order is created in CRM as usual
- If branch has Poster spot linked, order is automatically sent to Poster
- Success/error messages inform user of Poster integration status
- CRM order is NEVER affected by Poster errors

## Technical Notes

- Terminal (POS) must be used to ensure `order_items` have `product_poster_id`
- Manual order entry (text field) will NOT be sent to Poster (no products array)
- Service mode mapping: delivery=3, pickup=2, in_place=1
- All Poster API calls are proxied through Supabase Edge Functions
- CORS is properly configured for all edge functions
- Error handling ensures CRM functionality is never blocked by Poster issues
