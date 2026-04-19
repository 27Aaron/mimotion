self:
{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.services.mimotion;
in
{
  options.services.mimotion = {
    enable = lib.mkEnableOption "MiMotion auto step counter service";

    package = lib.mkOption {
      type = lib.types.package;
      default = self.packages.${pkgs.stdenv.hostPlatform.system}.mimotion;
      defaultText = "self.packages.<system>.mimotion";
      description = "MiMotion package to use.";
    };

    port = lib.mkOption {
      type = lib.types.port;
      default = 3000;
      description = "Port to listen on.";
    };

    dataDir = lib.mkOption {
      type = lib.types.path;
      default = "/var/lib/mimotion";
      description = "Data directory for database and runtime files.";
    };

    encryptionKey = lib.mkOption {
      type = lib.types.str;
      description = "AES-256-GCM encryption key (64-char hex string) for Xiaomi token storage.";
    };

    jwtSecret = lib.mkOption {
      type = lib.types.str;
      description = "JWT signing secret (64-char hex string).";
    };

    adminUsername = lib.mkOption {
      type = lib.types.str;
      default = "admin";
      description = "Initial admin username.";
    };

    adminPassword = lib.mkOption {
      type = lib.types.str;
      default = "password";
      description = "Initial admin password. Change after first login.";
    };

    appUrl = lib.mkOption {
      type = lib.types.nullOr lib.types.str;
      default = null;
      description = "Public URL for the app (used for Bark push icon).";
    };

    user = lib.mkOption {
      type = lib.types.str;
      default = "mimotion";
      description = "User to run the service as.";
    };

    group = lib.mkOption {
      type = lib.types.str;
      default = "mimotion";
      description = "Group to run the service as.";
    };

    environment = lib.mkOption {
      type = lib.types.attrsOf lib.types.str;
      default = { };
      example = lib.literalExpression ''
        {
          APP_URL = "https://steps.example.com";
        }
      '';
      description = "Extra environment variables for the service.";
    };
  };

  config = lib.mkIf cfg.enable {
    users.users.${cfg.user} = {
      group = cfg.group;
      isSystemUser = true;
      home = cfg.dataDir;
      createHome = false;
    };

    users.groups.${cfg.group} = { };

    systemd.tmpfiles.rules = [ "d ${cfg.dataDir} 0750 ${cfg.user} ${cfg.group} -" ];

    systemd.services.mimotion = {
      description = "MiMotion auto step counter service";
      wantedBy = [ "multi-user.target" ];
      after = [ "network.target" ];

      environment =
        {
          NODE_ENV = "production";
          PORT = toString cfg.port;
          HOSTNAME = "0.0.0.0";
          DATABASE_URL = "${cfg.dataDir}/mimotion.db";
          ENCRYPTION_KEY = cfg.encryptionKey;
          JWT_SECRET = cfg.jwtSecret;
          ADMIN_USERNAME = cfg.adminUsername;
          ADMIN_PASSWORD = cfg.adminPassword;
        }
        // (lib.optionalAttrs (cfg.appUrl != null) { APP_URL = cfg.appUrl; })
        // cfg.environment;

      serviceConfig = {
        Type = "simple";
        User = cfg.user;
        Group = cfg.group;
        WorkingDirectory = cfg.dataDir;
        ExecStart = "${cfg.package}/bin/mimotion";
        Restart = "on-failure";
        RestartSec = 5;

        # Security hardening
        ProtectHome = true;
        ProtectSystem = "strict";
        PrivateTmp = true;
        NoNewPrivileges = true;
        ReadWritePaths = cfg.dataDir;
      };
    };
  };
}
