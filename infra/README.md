# infra

部署面：openresty 当着门，systemd 管两个进程，backup.sh 管库，deploy.sh 一条命令滚版。

| 文件 | 落地位置 | 作用 |
|---|---|---|
| openresty/house.conf | /usr/local/openresty/nginx/conf/conf.d/ | 静态站 + `/house-api/` 反代 |
| systemd/house-api.service | /etc/systemd/system/ | API 常驻（127.0.0.1:8787） |
| systemd/house-worker.{service,timer} | /etc/systemd/system/ | worker 每 2 分钟领活 |
| systemd/house-backup.{service,timer} | /etc/systemd/system/ | 每日 03:20 热备 |
| backup.sh | /opt/house/infra/ | 备份 + 保留 14 份 |
| deploy.sh | 本机 | 构建 → 同步 → 重启 → 自检 |

## 首次上线

```bash
sudo useradd -r -s /usr/sbin/nologin house || true
sudo install -d -o house -g house /opt/house /var/lib/house /var/www/house /var/backups/house
# api.env / worker.env 手工写，chmod 600，里面是 HOUSE_INTERNAL_TOKEN
sudo cp infra/systemd/*.service infra/systemd/*.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now house-api house-worker.timer house-backup.timer
sudo cp infra/openresty/house.conf /usr/local/openresty/nginx/conf/conf.d/
sudo openresty -t && sudo systemctl reload openresty
curl -fsS http://127.0.0.1:8787/health
```

## 备份

```bash
sudo /opt/house/infra/backup.sh          # 手动跑一次验证
```

`/internal/*` 不经过 openresty：外网只能看到 `/house-api/` 下的公开路由。
