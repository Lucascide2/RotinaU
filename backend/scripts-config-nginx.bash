%%bash

sudo apt update
sudo apt install nginx certbot python3-certbot-nginx

sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'   # portas 80 e 443
sudo ufw enable

sudo mv ./nginx-rotinau.conf /etc/nginx/sites-available/rotinau

sudo ln -s /etc/nginx/sites-available/rotinau /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

sudo certbot --nginx -d api.seudominio.com