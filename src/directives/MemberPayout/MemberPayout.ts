/*
 * Copyright ©️ 2018 Galt•Space Society Construction and Terraforming Company 
 * (Founded by [Nikolai Popeka](https://github.com/npopeka),
 * [Dima Starodubcev](https://github.com/xhipster), 
 * [Valery Litvin](https://github.com/litvintech) by 
 * [Basic Agreement](http://cyb.ai/QmSAWEG5u5aSsUyMNYuX2A2Eaz4kEuoYWUkVBRdmu9qmct:ipfs)).
 * ​
 * Copyright ©️ 2018 Galt•Core Blockchain Company 
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) and 
 * Galt•Space Society Construction and Terraforming Company by 
 * [Basic Agreement](http://cyb.ai/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS:ipfs)).
 */

export default {
    name: 'member-payout',
    template: require('./MemberPayout.html'),
    props: ['address', 'iconMode'],
    created() {
        this.getPaymentInfo();
    },
    watch: {
        async address() {
            this.getPaymentInfo();
        }
    },
    methods: {
        async getPaymentInfo(){
            if(!this.address) {
                this.paymentInfo = null;
                return;
            }
            const member = await this.$cityContract.getMember(this.address);
            const tariff = await this.$cityContract.getTariffById(member.tariff);
            
            const currentTimeStamp = Math.floor(Date.now() / 1000);
            this.paymentInfo = {
                availableCount: member.lastTimestamp ? Math.floor((currentTimeStamp - member.lastTimestamp) / tariff.paymentPeriod) : 1
            };
            this.paymentInfo.nextPayment = member.lastTimestamp + (this.paymentInfo.availableCount + 1) * tariff.paymentPeriod;
            this.paymentInfo.amount = tariff.payment;
            this.paymentInfo.currency = tariff.currencyName;
        },
        
        claimPayment() {
            this.$galtUser.claimPaymentFor(this.address).then(() => {
                this.$notify({
                    type: 'success',
                    title: this.getLocale("success.claim.title", this.paymentInfo),
                    text: this.getLocale("success.claim.description", this.paymentInfo)
                });
                this.getPaymentInfo();
                this.$emit('claim-finish');
            }).catch(() => {
                this.$notify({
                    type: 'error',
                    title: this.getLocale("error.claim.title"),
                    text: this.getLocale("error.claim.description")
                });
            })
        },
        getLocale(key, options?) {
            return this.$locale.get(this.localeKey + "." + key, options);
        }
    },
    data() {
        return {
            localeKey: "member_payout",
            paymentInfo: null
        }
    }
}
