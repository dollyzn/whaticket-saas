#!/bin/bash
echo "Updating Whaticket, please wait."

git pull
cd backend
yarn
rm -rf dist
yarn build
npx sequelize db:migrate
npx sequelize db:seed
cd ../frontend
yarn
rm -rf build
yarn build
pm2 restart all

echo "Update finished. Enjoy!"
