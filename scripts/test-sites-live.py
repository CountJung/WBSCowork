"""CLI entry for read-only live HTTP smoke; not an authenticated UI test."""
from sites_test_network import main

if __name__ == '__main__':
    raise SystemExit(main())
