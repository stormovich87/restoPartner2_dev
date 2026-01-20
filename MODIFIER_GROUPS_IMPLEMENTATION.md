# Modifier Groups Implementation

## Overview
The POS terminal now supports advanced modifier grouping with validation logic based on Poster API data.

## Implementation Details

### 1. Database Schema
The `product_modifiers` table includes:
- `group_id` (bigint) - Poster group ID
- `group_name` (text) - Display name for the group
- `sort_order` (int) - Order within the product
- `min_amount` (int) - Minimum required selections
- `max_amount` (int) - Maximum allowed selections

### 2. Poster API Integration
The `poster-sync` edge function:
- Extracts `group_modifications` from each product
- Maps each modifier to its group with `dish_modification_group_id` and group `name`
- Extracts `num_min` and `num_max` for validation rules
- Loads modifier photos from `photo` or `photo_origin` fields
- Builds absolute URLs: `https://{account}.joinposter.com/{photo_path}`
- Saves all group data to `product_modifiers` table

### 3. Modifier Selector Component
Located in `src/components/ModifierSelector.tsx`

**Grouping Logic:**
- Loads modifiers with group information from `product_modifiers`
- Groups modifiers by `group_id` (or "default" if null)
- Each group shows: name, min/max requirements, and modifiers
- Groups without `group_name` default to "Набір 1"

**Validation:**
- Calculates total selected per group
- Checks `min_amount`: group is invalid if total < min_amount
- Checks `max_amount`: disables selection when total >= max_amount
- "Add to Check" button disabled until all group requirements met

**Visual Indicators:**
- Min requirement badge: green when met, red when not met
- Max limit badge: blue when valid, red when exceeded
- Disabled modifiers: opacity 50%, cursor not-allowed
- Selected modifiers: blue border, quantity badge, remove button

**Photo Display:**
- Square cards with photos from `photo_url`
- Falls back to package icon if no photo
- Product name and price below photo
- Selected state with dimmed opacity

### 4. User Experience
**Selection Flow:**
1. Click modifier to select (quantity +1)
2. Click again to increase quantity
3. Click X button to decrease/remove
4. Cannot exceed group maximum
5. Cannot add to check until all minimums met

**Error Feedback:**
- Warning message when requirements not met
- Visual color coding (red = invalid, green = valid)
- Disabled state for over-limit selections

## Key Features
- Multiple modifier groups per product
- Min/max validation per group
- Photo support from Poster API
- Real-time validation feedback
- Mobile responsive design
- Grouped display with clear headers

## Testing
After Poster sync:
1. Products with modifier groups load correctly
2. Groups display with proper names
3. Min/max requirements enforce correctly
4. Photos display from Poster
5. Add button enables only when valid
6. Selection counts update per group
