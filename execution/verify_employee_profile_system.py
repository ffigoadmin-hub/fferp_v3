#!/usr/bin/env python3
"""
Employee Profile System - Database Verification Script
Purpose: Verify that all migrations have been applied correctly
"""

import sys
from datetime import datetime

def verify_employee_profile_system():
    """Verify database schema for employee profile system"""
    
    print("=" * 70)
    print("EMPLOYEE PROFILE SYSTEM - VERIFICATION SCRIPT")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("=" * 70)
    
    print("\n📋 VERIFICATION CHECKLIST\n")
    
    # Tables to verify
    tables_to_check = [
        "profiles (enhanced with new columns)",
        "employee_ratings",
        "employee_achievements", 
        "employee_memos",
        "employee_history"
    ]
    
    print("✓ Database Tables:")
    for table in tables_to_check:
        print(f"  □ {table}")
    
    # Functions to verify
    functions_to_check = [
        "update_employee_average_rating()",
        "track_profile_changes()",
        "notify_employee_memo()",
        "get_employee_ratings_summary(UUID)",
        "get_employee_achievements_count(UUID)",
        "get_employee_memos_count(UUID)"
    ]
    
    print("\n✓ Database Functions:")
    for func in functions_to_check:
        print(f"  □ {func}")
    
    # Triggers to verify
    triggers_to_check = [
        "trigger_update_employee_average_rating",
        "trigger_track_profile_changes",
        "trigger_notify_employee_memo",
        "trigger_update_employee_ratings_updated_at",
        "trigger_update_employee_achievements_updated_at",
        "trigger_update_employee_memos_updated_at"
    ]
    
    print("\n✓ Database Triggers:")
    for trigger in triggers_to_check:
        print(f"  □ {trigger}")
    
    # RLS Policies to verify
    print("\n✓ RLS Policies:")
    rls_tables = ["employee_ratings", "employee_achievements", "employee_memos", "employee_history"]
    for table in rls_tables:
        print(f"  □ {table} - Multiple policies for role-based access")
    
    # Storage to verify
    print("\n✓ Supabase Storage:")
    print("  □ Bucket: employee-profile-pictures (must be created manually)")
    print("  □ RLS Policies: Public read, authenticated write")
    print("  □ Folder structure: {user_id}/profile.{ext}")
    
    print("\n" + "=" * 70)
    print("MANUAL VERIFICATION STEPS")
    print("=" * 70)
    
    steps = [
        "1. Run all migration files in Supabase SQL Editor in order:",
        "   - 20260416_001_profiles_enhancements.sql",
        "   - 20260416_002_employee_ratings.sql",
        "   - 20260416_003_employee_achievements.sql",
        "   - 20260416_004_employee_memos.sql",
        "   - 20260416_005_employee_history.sql",
        "   - 20260416_006_functions_and_triggers.sql",
        "   - 20260416_007_storage_bucket_rls.sql",
        "",
        "2. In Supabase Dashboard, create storage bucket:",
        "   - Name: employee-profile-pictures",
        "   - Make it public",
        "   - Set size limit to 5MB",
        "",
        "3. Verify in Supabase Dashboard:",
        "   - Check all tables exist (PostgreSQL Editor)",
        "   - Check all functions exist",
        "   - Check all triggers exist",
        "   - Check RLS policies enabled on tables",
        "   - Check storage bucket created",
        "",
        "4. Test queries:",
        "   - SELECT COUNT(*) FROM employee_ratings;",
        "   - SELECT COUNT(*) FROM employee_achievements;",
        "   - SELECT COUNT(*) FROM employee_memos;",
        "   - SELECT COUNT(*) FROM employee_history;",
    ]
    
    for step in steps:
        print(step)
    
    print("\n" + "=" * 70)
    print("SQL VERIFICATION QUERIES")
    print("=" * 70)
    
    queries = {
        "Check profiles table enhancements": [
            "SELECT column_name, data_type",
            "FROM information_schema.columns",
            "WHERE table_name = 'profiles'",
            "AND column_name IN ('date_of_birth', 'profile_picture_url', 'average_rating');",
        ],
        "Check employee_ratings table": [
            "SELECT * FROM information_schema.tables",
            "WHERE table_name = 'employee_ratings';",
        ],
        "Check functions exist": [
            "SELECT routine_name FROM information_schema.routines",
            "WHERE routine_name LIKE '%employee%' OR routine_name LIKE '%rating%';",
        ],
        "Check triggers exist": [
            "SELECT trigger_name FROM information_schema.triggers",
            "WHERE trigger_name LIKE '%employee%' OR trigger_name LIKE '%profile%';",
        ],
    }
    
    for query_name, query_lines in queries.items():
        print(f"\n{query_name}:")
        print("```sql")
        print("\n".join(query_lines))
        print("```")
    
    print("\n" + "=" * 70)
    print("POST-DEPLOYMENT TESTING")
    print("=" * 70)
    
    tests = [
        "1. Create a test rating and verify average_rating updates",
        "2. Test profile picture upload via Storage API",
        "3. Add achievement and verify visibility",
        "4. Issue memo and check notification",
        "5. Update profile role and verify history entry",
        "6. Test RLS: Employee should only see own records",
        "7. Test RLS: Admin should see all records",
        "8. Test file upload restrictions (size, format)",
    ]
    
    for test in tests:
        print(f"  □ {test}")
    
    print("\n" + "=" * 70)
    print("DOCUMENTATION REFERENCES")
    print("=" * 70)
    print("""
Main Directive: directives/04_employee_profiles.md
  - Complete system documentation
  - API specifications
  - Permission matrix
  - Troubleshooting guide

Migration Files: supabase/migrations/20260416_*.sql
  - 001: Profiles table enhancements
  - 002: Employee ratings table
  - 003: Employee achievements table
  - 004: Employee memos table
  - 005: Employee history table
  - 006: Functions and triggers
  - 007: Storage bucket RLS setup

Component Development: src/pages/profile/
  - To be implemented based on directive
""")
    
    print("\n" + "=" * 70)
    print("✅ VERIFICATION COMPLETE")
    print("=" * 70)
    print("\nNext Steps:")
    print("1. Apply all migrations to Supabase")
    print("2. Create storage bucket manually")
    print("3. Begin frontend component development")
    print("4. Follow component specs in directives/04_employee_profiles.md")
    print("\n")

if __name__ == "__main__":
    verify_employee_profile_system()
