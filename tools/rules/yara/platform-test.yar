rule SIH_Recovery_Platform_Test_2026 {
  meta:
    description = "Harmless test rule for recovery scanner verification"
  strings:
    $marker = "SIH_RECOVERY_TEST_PATTERN_2026" ascii
  condition:
    $marker
}
