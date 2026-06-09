# Menu Items Display Debug Guide

## Current Status
✅ **Snacks items showing correctly** - Items like "BREAD OMLETTE", "CHEESE BREAD OMLETTE" etc are displaying
❌ **Other categories not showing** - Breakfast, Lunch, Hot Drinks, etc. missing from order page

## Root Cause Analysis

The ordering page filters items by:
```typescript
// From useCafeMenu.ts
.eq('available_date', format(targetDate, 'yyyy-MM-dd'))  // Today's date
.eq('is_available', true)                                  // Must be available
.eq('out_of_stock', false)                                 // Must have stock
```

**Why only Snacks show:**
- Only Snacks items have **today's date** AND **is_available=true** AND **out_of_stock=false**
- Other category items either:
  - Don't have items created for today
  - Are created but marked as `out_of_stock=true`
  - Are marked as `is_available=false`
  - Have different available dates

## How to Fix

### Option 1: Add Items for Other Categories (RECOMMENDED)

**In Manager Dashboard** (`/cafe/manager`):

1. Click "Add Menu Item" or "Bulk Upload"
2. For each category (Breakfast, Lunch, Dinner, etc.), add items:
   - **Category**: Select from dropdown (breakfast, lunch, dinner, hot_drinks, cool_drinks, fresh_drinks, snack)
   - **Available Date**: Set to **TODAY** (YYYY-MM-DD format)
   - **Price**: Enter amount (e.g., 45 for ₹45)
   - **Is Available**: ✓ CHECK THIS
   - **Out of Stock**: ☐ UNCHECK THIS
   - **Item Name**: e.g., "Idli Sambar", "Biryani", "Coffee"
   - **Description**: Optional

3. Save each item
4. Verify they appear as "LIVE TODAY" in manager dashboard
5. Refresh `/palm-cafe` - new categories should appear

### Option 2: Check Existing Items

If you've already added items for other categories:

**Check in Manager Dashboard**:
- Look for items in categories like "breakfast", "lunch", "dinner"
- Verify each item shows:
  - ✓ "LIVE TODAY" (correct date)
  - ✓ "Published" status
  - ✓ "Is Available" checkbox is checked
  - ✓ "Out of Stock" checkbox is unchecked

**If items exist but don't show on order page**:
1. Click the item in manager
2. Verify:
   - `available_date` = TODAY (not yesterday or tomorrow)
   - `is_available` = true (checkmark visible)
   - `out_of_stock` = false (unchecked)
3. Save if you made changes
4. Refresh `/palm-cafe` in employee browser

### Option 3: Force Refresh Cache

If items were added but still don't appear:

**In browser (as employee)**:
1. Go to `/palm-cafe`
2. Open DevTools (F12)
3. Clear Application → Local Storage → Delete all
4. Hard refresh (Ctrl+Shift+Delete or Cmd+Shift+Delete)
5. Go back to `/palm-cafe`

## Category Mappings

Add items to these categories (in Manager Dashboard):

| Category | Display Name | Used in Sidebar |
|----------|--------------|-----------------|
| breakfast | Breakfast | ✓ |
| lunch | Lunch | ✓ |
| dinner | Dinner | ✓ |
| snack | Snacks | ✓ (Currently showing) |
| hot_drinks | Hot Drinks | ✓ |
| cool_drinks | Cool Drinks | ✓ |
| fresh_drinks | Fresh Drinks | ✓ |

## SQL Query to Check (Supabase)

To verify what items exist for today:

```sql
SELECT
  category,
  item_name,
  available_date,
  is_available,
  out_of_stock,
  price
FROM cafe_menu_items
WHERE DATE(available_date) = CURRENT_DATE
ORDER BY category, item_name;
```

**Expected Output**:
- Should show multiple rows across different categories
- All rows should have `is_available = true`
- All rows should have `out_of_stock = false`

If only Snacks category appears, you need to add items for other categories.

## Quick Test

**Test if filtering is working**:

1. Add ONE item in Breakfast category for today
2. Set all flags correctly (available=true, out_of_stock=false, date=today)
3. Go to `/palm-cafe`
4. Refresh page
5. Check if "Breakfast" tab appears in menu

If Breakfast appears with the new item, the issue was simply missing data.

## Common Issues & Solutions

### Issue: Items show in Manager but not in Order Page
**Solution**: Verify the date format and that today's date is set in `available_date` field

### Issue: Category appears but no items under it
**Solution**: Check that items in that category have `is_available=true` and `out_of_stock=false`

### Issue: Items appear in Manager as "CATALOGED" instead of "LIVE TODAY"
**Solution**: Check the available_date - if it's not today, change it to today's date

### Issue: Old date items showing
**Solution**: Filter by today's date only - edit items with old dates or create new ones

## Example Data to Add

Here are sample items you can add for testing:

**Breakfast** (available_date = today):
- Idli Sambar | ₹40
- Dosa | ₹50
- Uppma | ₹35

**Lunch** (available_date = today):
- Biryani | ₹80
- Chicken Curry | ₹75
- Vegetable Rice | ₹60

**Dinner** (available_date = today):
- Rotli Curry | ₹70
- Paneer Butter Masala | ₹65
- Dal Tadka | ₹40

**Hot Drinks** (available_date = today):
- Tea | ₹20
- Coffee | ₹25
- Hot Chocolate | ₹30

**Cool Drinks** (available_date = today):
- Lemonade | ₹30
- Cold Coffee | ₹40
- Juice | ₹35

## Next Steps

1. **Go to Manager Dashboard**: `/cafe/manager`
2. **Add items for breakfast, lunch, dinner** with today's date
3. **Verify "LIVE TODAY" status** for each new item
4. **Refresh `/palm-cafe`** in employee browser
5. **Check if new categories appear** in menu filter
6. **Test ordering** with items from different categories

---

**Note**: The code is working correctly - it's just filtering items by today's date, availability, and stock status. You just need to ensure you have items in multiple categories with today's date.
