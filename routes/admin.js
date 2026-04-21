const router=require('express').Router();
const {adminLogin,adminRegister,getClaimConnections,approveConnection,denyConnection,getAgencies,updateAgency,deleteAgency,getUsers,addUser,updateUser,deleteUser,resetPassword,getDashboardStats}=require('../controller/adminController')

router.post('/adminLogin',adminLogin)
router.post('/adminRegister',adminRegister)
router.post('/resetPassword',resetPassword)
router.get('/dashboard/stats', getDashboardStats);




router.get('/getUsers',          getUsers);
router.post('/addUser',          addUser);
router.patch('/updateUser/:id',  updateUser);
router.delete('/deleteUser/:id', deleteUser);



router.get('/getAgencies',           getAgencies);
router.patch('/updateAgency/:id',    updateAgency);
router.delete('/deleteAgency/:id',   deleteAgency);



router.get('/claims/pending-connections',          getClaimConnections);
router.patch('/claims/:id/approve-connection',     approveConnection);
router.patch('/claims/:id/deny-connection',        denyConnection);
module.exports=router;