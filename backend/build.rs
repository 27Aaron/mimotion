use std::{
    env, fs,
    path::{Path, PathBuf},
    process::Command,
    time::SystemTime,
};

const FRONTEND_INPUTS: &[&str] = &[
    "frontend/src",
    "frontend/public",
    "frontend/index.html",
    "frontend/package.json",
    "frontend/vite.config.ts",
    "frontend/postcss.config.mjs",
    "frontend/tsconfig.json",
    "frontend/eslint.config.mjs",
    "package.json",
    "package-lock.json",
];

fn main() {
    let manifest_dir =
        PathBuf::from(env::var_os("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR is set"));
    let project_root = manifest_dir
        .parent()
        .expect("backend must live under the project root")
        .to_path_buf();
    let frontend_dir = project_root.join("frontend");
    let dist_dir = frontend_dir.join("dist");

    for input in FRONTEND_INPUTS {
        println!("cargo:rerun-if-changed=../{input}");
    }
    println!("cargo:rerun-if-env-changed=MIMOTION_SKIP_FRONTEND_BUILD");
    println!("cargo:rerun-if-env-changed=MIMOTION_FORCE_FRONTEND_BUILD");

    if should_skip_frontend_build() {
        ensure_frontend_dist(&dist_dir);
        return;
    }

    let force_build = env::var_os("MIMOTION_FORCE_FRONTEND_BUILD").is_some();
    if !force_build && !frontend_build_is_needed(&frontend_dir, &dist_dir) {
        return;
    }

    let status = Command::new("npm")
        .current_dir(&project_root)
        .args(["run", "build:frontend"])
        .status()
        .unwrap_or_else(|error| {
            panic!(
                "无法执行 npm 构建前端。请先安装 Node.js/npm，或设置 \
                 MIMOTION_SKIP_FRONTEND_BUILD=1 使用已有的 frontend/dist：{error}"
            )
        });

    if !status.success() {
        panic!("前端构建失败，npm 退出状态：{status}");
    }

    ensure_frontend_dist(&dist_dir);
}

fn should_skip_frontend_build() -> bool {
    matches!(
        env::var("MIMOTION_SKIP_FRONTEND_BUILD").as_deref(),
        Ok("1" | "true" | "yes")
    )
}

fn ensure_frontend_dist(dist_dir: &Path) {
    if !dist_dir.join("index.html").is_file() {
        panic!(
            "frontend/dist/index.html 不存在。请先运行 npm run build:frontend，\
             或移除 MIMOTION_SKIP_FRONTEND_BUILD"
        );
    }
}

fn frontend_build_is_needed(frontend_dir: &Path, dist_dir: &Path) -> bool {
    let dist_index = dist_dir.join("index.html");
    let Some(dist_modified) = modified_at(&dist_index) else {
        return true;
    };

    [
        "src",
        "public",
        "index.html",
        "package.json",
        "vite.config.ts",
        "postcss.config.mjs",
        "tsconfig.json",
        "eslint.config.mjs",
    ]
    .iter()
    .map(|path| frontend_dir.join(path))
    .chain([
        frontend_dir
            .parent()
            .expect("frontend must have a project root")
            .join("package.json"),
        frontend_dir
            .parent()
            .expect("frontend must have a project root")
            .join("package-lock.json"),
    ])
    .filter_map(|path| latest_modified_at(&path))
    .any(|modified| modified > dist_modified)
}

fn latest_modified_at(path: &Path) -> Option<SystemTime> {
    if path.is_dir() {
        let mut latest = modified_at(path);
        let entries = fs::read_dir(path).ok()?;
        for entry in entries.flatten() {
            if let Some(modified) = latest_modified_at(&entry.path())
                && latest.is_none_or(|current| modified > current)
            {
                latest = Some(modified);
            }
        }
        latest
    } else {
        modified_at(path)
    }
}

fn modified_at(path: &Path) -> Option<SystemTime> {
    fs::metadata(path).ok()?.modified().ok()
}
