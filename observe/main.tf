terraform {
  required_providers {
    observe = {
      source  = "observeinc/observe"
      version = "~> 0.14"
    }
  }
}

provider "observe" {}
