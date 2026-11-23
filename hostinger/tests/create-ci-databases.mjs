// Fixed, disposable GitHub Actions fixtures only. No application secrets/data.
import mysql from 'mysql2/promise';
if(process.env.GITHUB_ACTIONS!=='true')throw new Error('This helper only runs in the disposable GitHub Actions job.');
const connection=await mysql.createConnection({host:'127.0.0.1',port:3306,user:'root',password:process.env.NW_CI_DB_PASSWORD,multipleStatements:false});
try{
  await connection.execute('CREATE DATABASE IF NOT EXISTS `northwall_test_auth_ci` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin');
  await connection.execute("GRANT ALL PRIVILEGES ON `northwall_test_auth_ci`.* TO 'northwall_ci'@'%'");
}finally{await connection.end();}
