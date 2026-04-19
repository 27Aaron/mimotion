self:
{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.services.mimotion;

  envVars =
    {
      NODE_ENV = "production";
      PORT = toString cfg.port;
      HOSTNAME = "0.0.0.0";
      DATABASE_URL = "${cfg.dataDir}/mimotion.db";
      ADMIN_USERNAME = cfg.adminUsername;
      ADMIN_PASSWORD = cfg.adminPassword;
    }
    // (lib.optionalAttrs (cfg.encryptionKey != null) { ENCRYPTION_KEY = cfg.encryptionKey; })
    // (lib.optionalAttrs (cfg.jwtSecret != null) { JWT_SECRET = cfg.jwtSecret; })
    // (lib.optionalAttrs (cfg.appUrl != null) { APP_URL = cfg.appUrl; })
    // cfg.environment;
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
      default = "${config.xdg.dataHome}/mimotion";
      defaultText = "\${config.xdg.dataHome}/mimotion";
      description = "Data directory for database and runtime files.";
    };

    encryptionKey = lib.mkOption {
      type = lib.types.nullOr lib.types.str;
      default = null;
      description = "AES-256-GCM encryption key (64-char hex string). WARNING: stored in Nix store. Prefer environmentFile for secrets.";
    };

    jwtSecret = lib.mkOption {
      type = lib.types.nullOr lib.types.str;
      default = null;
      description = "JWT signing secret (64-char hex string). WARNING: stored in Nix store. Prefer environmentFile for secrets.";
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

    environmentFile = lib.mkOption {
      type = lib.types.nullOr lib.types.path;
      default = null;
      example = "/run/secrets/mimotion.env";
      description = "File with environment variables (KEY=VALUE). Use for secrets like ENCRYPTION_KEY and JWT_SECRET.";
    };
  };

  config = lib.mkIf cfg.enable (lib.mkMerge [
    # --- Linux: systemd user service ---
    (lib.mkIf pkgs.stdenv.isLinux {
      systemd.user.services.mimotion = {
        Unit = {
          Description = "MiMotion auto step counter service";
          After = [ "network.target" ];
        };

        Service =
          {
            Type = "simple";
            ExecStart = "${cfg.package}/bin/mimotion";
            Restart = "on-failure";
            RestartSec = 5;
            Environment = lib.mapAttrsToList (k: v: "${k}=${v}") envVars;
          }
          // lib.optionalAttrs (cfg.environmentFile != null) {
            EnvironmentFile = cfg.environmentFile;
          };

        Install = {
          WantedBy = [ "default.target" ];
        };
      };
    })

    # --- macOS: launchd agent ---
    (lib.mkIf pkgs.stdenv.isDarwin {
      launchd.agents.mimotion = {
        enable = true;
        config = {
          ProgramArguments =
            if cfg.environmentFile != null then
              [
                "${
                  pkgs.writeShellScript "mimotion-launchd" ''
                    set -a
                    . ${cfg.environmentFile}
                    set +a
                    exec ${cfg.package}/bin/mimotion
                  ''
                }"
              ]
            else
              [ "${cfg.package}/bin/mimotion" ];
          EnvironmentVariables = envVars;
          RunAtLoad = true;
          KeepAlive.Crashed = true;
          StandardOutPath = "${cfg.dataDir}/mimotion.log";
          StandardErrorPath = "${cfg.dataDir}/mimotion.err";
        };
      };
    })
  ]);
}
