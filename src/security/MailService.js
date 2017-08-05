const nodemailer = require('nodemailer')
const Promise = require('bluebird')

const Config = require('../Config')

let pSendMail = null

exports.aSendEmail = async function (to, subject, content) {
    if (!Config.mail) throw new Error('无发信机制')
    let mailOptions = {from: Config.mail.user, to, subject, text: content}
    let pSendMail = prepareSender()
    await pSendMail(mailOptions)
}

function prepareSender() {
    if (pSendMail) return pSendMail

    let transporter = nodemailer.createTransport({
        host: config.mail.host, port: config.mail.port,
        auth: {user: config.mail.user, pass: config.mail.password}
    })
    pSendMail = Promise.promisify(transporter.sendMail.bind(transporter))
    return pSendMail
}