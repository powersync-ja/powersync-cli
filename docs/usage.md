# Pulling an Existing Project For Config

```bash
powersync login

# IDs taken from the PowerSync Dashboard URL
powersync pull config --org-id=5cc84a3ccudjfhgytw0c08b --project-id=6703fd8a3cfe3000hrydg463 --instance-id=688736sdfcfb46688f509bd0

# Make any required changes to the YAML files in the powersync/ directory.

# Deploy changes
powersync deploy
```
