const Agency = require('../models/agency');



exports.createAgency = async(req,res)=>{
    try {
        const agency = await Agency.create(req.body);
        res.status(201).json({ agency });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
}

exports.getAgencies = async (req, res) => {
  try {
    const agencies = await Agency.find({ is_active: true });
    res.status(200).json({ agencies });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


exports.getAgencyById = async (req, res) => {
  try {
    const agency = await Agency.findById(req.params.id);
    if (!agency) return res.status(404).json({ message: 'Agency not found' });

    res.status(200).json({ agency });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};




